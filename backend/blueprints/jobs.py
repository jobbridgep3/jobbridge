from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.matching_service import match_score, rank_vacancies_for_jobseeker
from services.notification_service import notify_role, notify_user
from services.pdf_service import to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api")


@jobs_bp.get("/jobs")
@jwt_required(optional=True)
def list_jobs():
    query = Vacancy.query.filter_by(status="active")

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
    vacancies = Vacancy.query.filter_by(status="active").all()
    ranked = rank_vacancies_for_jobseeker(profile, vacancies)[:5]
    return ok([v.to_dict(match_score=score) for v, score in ranked])


@jobs_bp.get("/jobs/<vacancy_id>")
@jwt_required(optional=True)
def get_job(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Job not found.", 404)

    score = None
    identity = get_jwt_identity()
    if identity:
        profile = JobseekerProfile.query.filter_by(user_id=identity).first()
        if profile:
            score = match_score(profile, vacancy)
    return ok(vacancy.to_dict(match_score=score))


@jobs_bp.post("/applications")
@jwt_required()
@role_required("jobseeker")
def apply_to_job():
    data = request.get_json(force=True) or {}
    vacancy_id = data.get("vacancy_id")
    vacancy = Vacancy.query.get(vacancy_id) if vacancy_id else None
    if not vacancy or vacancy.status != "active":
        return fail("This job is not currently accepting applications.", 400)

    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile before applying.", 400)

    if Application.query.filter_by(vacancy_id=vacancy.id, jobseeker_profile_id=profile.id).first():
        return fail("You have already applied to this job.", 409)

    score = match_score(profile, vacancy)
    application = Application(vacancy_id=vacancy.id, jobseeker_profile_id=profile.id, status="applied", match_score=score)
    db.session.add(application)
    db.session.commit()

    log_audit(User.query.get(profile.user_id), "Create", "applications", application.id, f"Applied to {vacancy.title}")
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
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok({"applied": 0, "under_review": 0, "interview_scheduled": 0, "hired": 0})
    apps = Application.query.filter_by(jobseeker_profile_id=profile.id).all()
    summary = {"applied": 0, "under_review": 0, "interview_scheduled": 0, "hired": 0}
    for a in apps:
        if a.status in summary:
            summary[a.status] += 1
    return ok(summary)


@jobs_bp.delete("/applications/<application_id>")
@jwt_required()
@role_required("jobseeker")
def cancel_application(application_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    application = Application.query.get(application_id)
    if not application or not profile or application.jobseeker_profile_id != profile.id:
        return fail("Application not found.", 404)
    if application.status not in ("applied", "under_review"):
        return fail("This application can no longer be cancelled.", 400)
    application.status = "cancelled"
    db.session.commit()
    return ok(message="Application cancelled.")


@jobs_bp.get("/referral-letter/<application_id>")
@jwt_required()
def download_referral_letter(application_id):
    application = Application.query.get(application_id)
    if not application or not application.referral_letter:
        return fail("Referral letter not available.", 404)
    return ok({"pdf_url": application.referral_letter.pdf_url})
