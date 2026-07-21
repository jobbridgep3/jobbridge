from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import APPLICATION_STATUS_LABELS, Application
from models.employer_hr import EmployerHRProfile
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.application_status_service import build_timeline, is_currently_employed_at_company, record_initial_history, transition_application
from services.audit_service import log_audit
from services.matching_service import match_score, rank_vacancies_for_jobseeker
from services.notification_service import notify_role, notify_user
from services.pdf_service import generate_table_report, to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api")


@jobs_bp.get("/jobs")
@jwt_required(optional=True)
def list_jobs():
    query = Vacancy.query.filter_by(status="published").filter(Vacancy.deleted_at.is_(None))

    keyword = request.args.get("q")
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(db.or_(Vacancy.title.ilike(like), Vacancy.skills_required.ilike(like)))
    if request.args.get("location"):
        query = query.filter(Vacancy.work_location.ilike(f"%{request.args['location']}%"))
    if request.args.get("job_type"):
        query = query.filter_by(job_type=request.args["job_type"])
    if request.args.get("industry"):
        query = query.filter_by(industry=request.args["industry"])

    vacancies = query.order_by(Vacancy.created_at.desc()).all()

    profile = None
    identity = get_jwt_identity()
    if identity:
        profile = JobseekerProfile.query.filter_by(user_id=identity).first()

    if profile:
        ranked = rank_vacancies_for_jobseeker(profile, vacancies)
        return ok([v.to_dict(match_score=score) for v, score in ranked])
    return ok([v.to_dict() for v in vacancies])


@jobs_bp.get("/jobs/recommended")
@jwt_required()
@role_required("jobseeker")
def recommended_jobs():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Profile not found.", 404)
    vacancies = Vacancy.query.filter_by(status="published").filter(Vacancy.deleted_at.is_(None)).all()
    ranked = rank_vacancies_for_jobseeker(profile, vacancies)[:5]
    return ok([v.to_dict(match_score=score) for v, score in ranked])


@jobs_bp.get("/jobs/<vacancy_id>")
@jwt_required(optional=True)
def get_job(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Job not found.", 404)

    score = None
    already_hired_at_company = False
    identity = get_jwt_identity()
    if identity:
        profile = JobseekerProfile.query.filter_by(user_id=identity).first()
        if profile:
            score = match_score(profile, vacancy)
            already_hired_at_company = is_currently_employed_at_company(profile.id, vacancy.employer_company_id)

    result = vacancy.to_dict(match_score=score)
    hired_count = Application.query.filter_by(vacancy_id=vacancy.id, status="hired").count()
    result["slots_remaining"] = max((vacancy.num_slots or 1) - hired_count, 0)
    result["already_hired_at_company"] = already_hired_at_company
    return ok(result)


@jobs_bp.post("/applications")
@jwt_required()
@role_required("jobseeker")
def apply_to_job():
    data = request.get_json(force=True) or {}
    vacancy_id = data.get("vacancy_id")
    vacancy = Vacancy.query.get(vacancy_id) if vacancy_id else None
    if not vacancy or vacancy.status != "published" or vacancy.deleted_at:
        return fail("This job is not currently accepting applications.", 400)

    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile before applying.", 400)

    if Application.query.filter_by(vacancy_id=vacancy.id, jobseeker_profile_id=profile.id).first():
        return fail("You have already applied to this job.", 409)

    if is_currently_employed_at_company(profile.id, vacancy.employer_company_id):
        return fail("You are currently employed by this company. You cannot apply to another vacancy until your employment has ended.", 409)

    score = match_score(profile, vacancy)
    application = Application(vacancy_id=vacancy.id, jobseeker_profile_id=profile.id, status="applied", match_score=score)
    db.session.add(application)
    db.session.commit()

    jobseeker_user = User.query.get(profile.user_id)
    record_initial_history(application, jobseeker_user)

    # Auto-attach an approved, unattached referral letter (vacancy-specific first,
    # then a general one) so the employer sees it among the applicant's documents.
    from models.referral import ReferralLetter
    letter = (
        ReferralLetter.query.filter_by(jobseeker_profile_id=profile.id, status="approved", application_id=None)
        .filter(db.or_(ReferralLetter.vacancy_id == vacancy.id, ReferralLetter.vacancy_id.is_(None)))
        .order_by(ReferralLetter.vacancy_id.desc().nullslast())
        .first()
    )
    if letter:
        letter.application_id = application.id
        db.session.commit()

    log_audit(jobseeker_user, "Create", "applications", application.id, f"Applied to {vacancy.title}")
    notify_user(
        vacancy.employer_company.user_id, "new_applicant",
        "New applicant received", f"{profile.full_name} applied to {vacancy.title}",
        link="/employer/applicants", socket_event="application:new", socket_payload={"application_id": str(application.id)},
    )
    return ok(application.to_dict(), "Application submitted.", 201)


@jobs_bp.get("/applications")
@jwt_required()
@role_required("jobseeker")
def my_applications():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    apps = Application.query.filter_by(jobseeker_profile_id=profile.id).order_by(Application.created_at.desc()).all()
    return ok([a.to_dict() for a in apps])


@jobs_bp.get("/applications/summary")
@jwt_required()
@role_required("jobseeker")
def applications_summary():
    summary = {status: 0 for status in APPLICATION_STATUS_LABELS}
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok(summary)
    apps = Application.query.filter_by(jobseeker_profile_id=profile.id).all()
    for a in apps:
        if a.status in summary:
            summary[a.status] += 1
    return ok(summary)


@jobs_bp.get("/applications/export/pdf")
@jwt_required()
@role_required("jobseeker")
def export_my_applications():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Profile not found.", 404)
    apps = Application.query.filter_by(jobseeker_profile_id=profile.id).order_by(Application.created_at.desc()).all()
    rows = [
        [
            a.reference_no,
            a.vacancy.title if a.vacancy else "",
            a.vacancy.employer_company.company_name if a.vacancy and a.vacancy.employer_company else "",
            a.created_at.strftime("%b %d, %Y") if a.created_at else "",
            APPLICATION_STATUS_LABELS.get(a.status, a.status),
            a.updated_at.strftime("%b %d, %Y") if a.updated_at else "",
        ]
        for a in apps
    ]
    pdf = generate_table_report(
        f"Application History — {profile.full_name}",
        ["Reference No.", "Position", "Company", "Date Applied", "Status", "Last Updated"],
        rows, now_manila().strftime("%B %d, %Y"),
    )
    return send_file(to_bytesio(pdf), mimetype="application/pdf", as_attachment=True, download_name="my-applications.pdf")


@jobs_bp.get("/applications/<application_id>")
@jwt_required()
@role_required("jobseeker")
def application_detail(application_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    application = Application.query.get(application_id)
    if not application or not profile or application.jobseeker_profile_id != profile.id:
        return fail("Application not found.", 404)

    vacancy = application.vacancy
    company = vacancy.employer_company if vacancy else None
    hr = EmployerHRProfile.query.filter_by(user_id=company.user_id).first() if company else None

    result = application.to_dict()
    result["timeline"] = build_timeline(application)
    result["interviews"] = [i.to_dict() for i in sorted(application.interviews, key=lambda i: i.scheduled_date or i.created_at)]
    result["hr_representative"] = (
        {"full_name": hr.full_name, "position": hr.position, "department": hr.department} if hr and hr.full_name else None
    )
    result["vacancy"] = vacancy.to_dict() if vacancy else None
    result["referral_letter"] = application.referral_letter.to_dict() if application.referral_letter else None
    result["document_requests"] = [r.to_dict() for r in application.document_requests]
    result["job_offer"] = application.job_offer.to_dict() if application.job_offer else None
    return ok(result)


@jobs_bp.delete("/applications/<application_id>")
@jwt_required()
@role_required("jobseeker")
def cancel_application(application_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    application = Application.query.get(application_id)
    if not application or not profile or application.jobseeker_profile_id != profile.id:
        return fail("Application not found.", 404)
    if application.status not in ("applied", "under_review"):
        return fail("This application can no longer be withdrawn.", 400)
    success, error = transition_application(
        application, "cancelled", User.query.get(profile.user_id), note="Withdrawn by applicant",
    )
    if not success:
        return fail(error, 400)
    return ok(message="Application withdrawn.")


@jobs_bp.get("/referral-letter/<application_id>")
@jwt_required()
def download_referral_letter(application_id):
    application = Application.query.get(application_id)
    if not application or not application.referral_letter or not application.referral_letter.pdf_url:
        return fail("Referral letter not available.", 404)
    # Only the owning jobseeker, the vacancy's employer, or staff/admin may fetch it.
    from flask_jwt_extended import get_jwt
    role = get_jwt().get("role")
    identity = get_jwt_identity()
    if role == "jobseeker":
        profile = JobseekerProfile.query.filter_by(user_id=identity).first()
        if not profile or application.jobseeker_profile_id != profile.id:
            return fail("Referral letter not available.", 404)
    elif role == "employer":
        from models.employer import EmployerCompany
        company = EmployerCompany.query.filter_by(user_id=identity).first()
        if not company or application.vacancy.employer_company_id != company.id:
            return fail("Referral letter not available.", 404)
    return ok({"pdf_url": application.referral_letter.pdf_url})
