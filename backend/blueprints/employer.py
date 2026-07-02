from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.matching_service import rank_jobseekers_for_vacancy
from services.notification_service import notify_role, notify_user
from utils.decorators import role_required
from utils.responses import fail, ok

employer_bp = Blueprint("employer", __name__, url_prefix="/api/employer")
company_bp = Blueprint("company", __name__, url_prefix="/api/company")
vacancies_bp = Blueprint("vacancies", __name__, url_prefix="/api/vacancies")
applicants_bp = Blueprint("applicants", __name__, url_prefix="/api/applicants")


def _company() -> EmployerCompany:
    return EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()


# ---------- Dashboard / Profile ----------

@employer_bp.get("/dashboard-stats")
@jwt_required()
@role_required("employer")
def dashboard_stats():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    vacancy_ids = [v.id for v in Vacancy.query.filter_by(employer_company_id=company.id).all()]
    active_count = Vacancy.query.filter_by(employer_company_id=company.id, status="active").count()
    applicant_count = Application.query.filter(Application.vacancy_id.in_(vacancy_ids)).count() if vacancy_ids else 0
    return ok({
        "active_vacancies": active_count,
        "total_applicants": applicant_count,
        "company_verification_status": company.verification_status,
    })


@employer_bp.get("/profile")
@jwt_required()
@role_required("employer")
def get_employer_profile():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(company.to_dict(include_email=User.query.get(company.user_id).email))


@employer_bp.put("/profile")
@jwt_required()
@role_required("employer")
def update_employer_profile():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("hr_contact_name", "contact_number"):
        if field in data:
            setattr(company, field, data[field])
    db.session.commit()
    return ok(company.to_dict(), "Profile updated.")


# ---------- Company Profile ----------

@company_bp.get("")
@jwt_required()
@role_required("employer")
def get_company():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(company.to_dict())


@company_bp.put("")
@jwt_required()
@role_required("employer")
def update_company():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("company_name", "address", "industry", "business_permit_no", "description", "website"):
        if field in data:
            setattr(company, field, data[field])
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id)
    return ok(company.to_dict(), "Company profile updated.")


@company_bp.post("/logo")
@jwt_required()
@role_required("employer")
def upload_logo():
    from services.storage_service import upload_file

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)
    file = request.files["file"]
    company.logo_url = upload_file(file.read(), file.filename, folder=f"logos/{company.id}", content_type=file.mimetype)
    db.session.commit()
    return ok(company.to_dict(), "Logo uploaded.")


@company_bp.post("/documents")
@jwt_required()
@role_required("employer")
def upload_documents():
    from services.storage_service import upload_file

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)
    file = request.files["file"]
    url = upload_file(file.read(), file.filename, folder=f"company-docs/{company.id}", content_type=file.mimetype)
    company.document_urls = [*(company.document_urls or []), url]
    db.session.commit()
    return ok(company.to_dict(), "Document uploaded.")


# ---------- Vacancy Management ----------

@vacancies_bp.get("/my")
@jwt_required()
@role_required("employer")
def my_vacancies():
    company = _company()
    if not company:
        return ok([])
    vacancies = Vacancy.query.filter_by(employer_company_id=company.id).order_by(Vacancy.created_at.desc()).all()
    return ok([v.to_dict() for v in vacancies])


@vacancies_bp.post("")
@jwt_required()
@role_required("employer")
def create_vacancy():
    company = _company()
    if not company:
        return fail("Complete your company profile before posting a vacancy.", 400)
    data = request.get_json(force=True) or {}
    if not data.get("title"):
        return fail("Job title is required.", 400)

    vacancy = Vacancy(
        employer_company_id=company.id,
        title=data["title"],
        description=data.get("description", ""),
        requirements=data.get("requirements"),
        skills_required=data.get("skills_required"),
        salary_min=data.get("salary_min"),
        salary_max=data.get("salary_max"),
        job_type=data.get("job_type"),
        industry=data.get("industry"),
        num_slots=data.get("num_slots", 1),
        work_location=data.get("work_location"),
        status="pending",
    )
    db.session.add(vacancy)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "vacancies", vacancy.id)
    notify_role("staff", "vacancy:submitted", {"vacancy_id": str(vacancy.id), "title": vacancy.title})
    return ok(vacancy.to_dict(), "Vacancy submitted for PESO Staff approval.", 201)


@vacancies_bp.put("/<vacancy_id>")
@jwt_required()
@role_required("employer")
def update_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id:
        return fail("Vacancy not found.", 404)
    if vacancy.status not in ("pending", "active"):
        return fail("This vacancy can no longer be edited.", 400)

    data = request.get_json(force=True) or {}
    for field in ("title", "description", "requirements", "skills_required", "salary_min", "salary_max",
                  "job_type", "industry", "num_slots", "work_location"):
        if field in data:
            setattr(vacancy, field, data[field])
    db.session.commit()
    return ok(vacancy.to_dict(), "Vacancy updated.")


@vacancies_bp.delete("/<vacancy_id>")
@jwt_required()
@role_required("employer")
def close_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id:
        return fail("Vacancy not found.", 404)
    vacancy.status = "closed"
    db.session.commit()
    return ok(message="Vacancy closed.")


@vacancies_bp.get("/<vacancy_id>/matched-jobseekers")
@jwt_required()
@role_required("employer")
def matched_jobseekers(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    profiles = JobseekerProfile.query.filter_by(is_verified_by_staff=True).limit(200).all()
    ranked = rank_jobseekers_for_vacancy(vacancy, profiles)[:10]
    return ok([{"profile": p.to_dict(), "match_score": score} for p, score in ranked if score > 0])


# ---------- Applicant Management ----------

@applicants_bp.get("")
@jwt_required()
@role_required("employer")
def list_applicants():
    company = _company()
    if not company:
        return ok([])
    query = Application.query.join(Vacancy).filter(Vacancy.employer_company_id == company.id)
    if request.args.get("vacancy_id"):
        query = query.filter(Application.vacancy_id == request.args["vacancy_id"])
    if request.args.get("status"):
        query = query.filter(Application.status == request.args["status"])
    apps = query.order_by(Application.created_at.desc()).all()
    return ok([a.to_dict() for a in apps])


@applicants_bp.get("/<application_id>")
@jwt_required()
@role_required("employer")
def get_applicant(application_id):
    application = Application.query.get(application_id)
    if not application:
        return fail("Applicant not found.", 404)
    result = application.to_dict()
    result["jobseeker_profile"] = application.jobseeker_profile.to_dict()
    return ok(result)


@applicants_bp.put("/<application_id>/status")
@jwt_required()
@role_required("employer")
def update_applicant_status(application_id):
    application = Application.query.get(application_id)
    if not application:
        return fail("Applicant not found.", 404)
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in ("under_review", "hired", "rejected"):
        return fail("Invalid status.", 400)

    application.status = new_status
    if "feedback_note" in data:
        application.feedback_note = data["feedback_note"]
    if "employer_notes" in data:
        application.employer_notes = data["employer_notes"]
    db.session.commit()

    jobseeker_user_id = application.jobseeker_profile.user_id
    notify_user(
        jobseeker_user_id, "application_status", f"Application status: {new_status.replace('_', ' ').title()}",
        f"Your application for {application.vacancy.title} is now {new_status.replace('_', ' ')}.",
        link="/jobseeker/applications", socket_event="application:status_update",
        socket_payload={"application_id": str(application.id), "new_status": new_status},
    )

    if new_status == "hired":
        from blueprints.employment import create_employment_record_for_application
        create_employment_record_for_application(application)

    return ok(application.to_dict(), "Applicant status updated.")


@applicants_bp.post("/bulk-reject")
@jwt_required()
@role_required("employer")
def bulk_reject():
    data = request.get_json(force=True) or {}
    ids = data.get("application_ids", [])
    apps = Application.query.filter(Application.id.in_(ids), Application.status.in_(("applied", "under_review"))).all()
    for a in apps:
        a.status = "rejected"
    db.session.commit()
    return ok(message=f"{len(apps)} applicant(s) rejected.")


@applicants_bp.post("/<application_id>/referral-request")
@jwt_required()
@role_required("employer")
def request_referral(application_id):
    application = Application.query.get(application_id)
    if not application:
        return fail("Applicant not found.", 404)
    notify_role("staff", "referral:requested", {"application_id": str(application.id)})
    return ok(message="Referral letter requested from PESO Staff.")
