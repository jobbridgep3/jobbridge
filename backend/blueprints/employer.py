from marshmallow import ValidationError
from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import COMPANY_DOCUMENT_TYPES, COMPANY_MANDATORY_DOCUMENT_TYPES, EmployerCompany, EmployerCompanyDocument
from models.employer_hr import HR_DOCUMENT_TYPES, EmployerHRDocument, EmployerHRProfile
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy, VacancyCategory, VacancyScreeningQuestion
from schemas.employer_schemas import CompanyProfileSchema, HRProfileSchema
from schemas.vacancy_schemas import VacancyWriteSchema
from services.audit_service import log_audit
from services.matching_service import rank_jobseekers_for_vacancy
from services.notification_service import notify_role, notify_user
from services.profile_completion_service import COMPANY_REQUIRED_FIELDS, HR_REQUIRED_FIELDS, compute_completion
from services.vacancy_state_service import can_transition
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

employer_bp = Blueprint("employer", __name__, url_prefix="/api/employer")
company_bp = Blueprint("company", __name__, url_prefix="/api/company")
vacancies_bp = Blueprint("vacancies", __name__, url_prefix="/api/vacancies")
applicants_bp = Blueprint("applicants", __name__, url_prefix="/api/applicants")


def _company() -> EmployerCompany:
    return EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()


def _hr_profile() -> EmployerHRProfile:
    return EmployerHRProfile.query.filter_by(user_id=get_jwt_identity()).first()


# ---------- Dashboard / Profile ----------

@employer_bp.get("/dashboard-stats")
@jwt_required()
@role_required("employer")
def dashboard_stats():
    """Deprecated — superseded by /dashboard/summary. Kept so no existing caller 404s."""
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    vacancy_ids = [v.id for v in Vacancy.query.filter_by(employer_company_id=company.id).all()]
    active_count = Vacancy.query.filter_by(employer_company_id=company.id, status="published").count()
    applicant_count = Application.query.filter(Application.vacancy_id.in_(vacancy_ids)).count() if vacancy_ids else 0
    return ok({
        "active_vacancies": active_count,
        "total_applicants": applicant_count,
        "company_verification_status": company.accreditation_status,
    })


@employer_bp.get("/dashboard/summary")
@jwt_required()
@role_required("employer")
def employer_dashboard_summary():
    from services.employer_dashboard_service import build_summary

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(build_summary(company))


@employer_bp.get("/dashboard/analytics")
@jwt_required()
@role_required("employer")
def employer_dashboard_analytics():
    from services.employer_dashboard_service import build_analytics

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    months = int(request.args.get("months", 6))
    return ok(build_analytics(company, months, request.args.get("date_from"), request.args.get("date_to")))


@employer_bp.get("/dashboard/pending-actions")
@jwt_required()
@role_required("employer")
def employer_dashboard_pending_actions():
    from services.employer_dashboard_service import build_pending_actions

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(build_pending_actions(company, _hr_profile()))


@employer_bp.get("/dashboard/recent-applicants")
@jwt_required()
@role_required("employer")
def employer_dashboard_recent_applicants():
    from services.employer_dashboard_service import build_recent_applicants

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(build_recent_applicants(company))


@employer_bp.get("/dashboard/recent-activity")
@jwt_required()
@role_required("employer")
def employer_dashboard_recent_activity():
    from services.employer_dashboard_service import build_recent_activity

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(build_recent_activity(company))


@employer_bp.get("/dashboard/insights")
@jwt_required()
@role_required("employer")
def employer_dashboard_insights():
    from services.employer_dashboard_service import build_company_insights

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    return ok(build_company_insights(company))


@employer_bp.get("/dashboard/export/excel")
@jwt_required()
@role_required("employer")
def employer_dashboard_export_excel():
    from services.employer_dashboard_service import build_employer_dashboard_excel

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    buf = build_employer_dashboard_excel(company, request.args)
    log_audit(User.query.get(company.user_id), "Export", "employer_dashboard")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="dashboard_report.xlsx")


@employer_bp.get("/dashboard/export/pdf")
@jwt_required()
@role_required("employer")
def employer_dashboard_export_pdf():
    from services.employer_dashboard_service import build_employer_dashboard_pdf
    from services.pdf_service import to_bytesio

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    actor = User.query.get(company.user_id)
    pdf_bytes = build_employer_dashboard_pdf(company, request.args, actor.email)
    log_audit(actor, "Export", "employer_dashboard")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="dashboard_report.pdf")


@employer_bp.get("/profile")
@jwt_required()
@role_required("employer")
def get_employer_profile():
    profile = _hr_profile()
    if not profile:
        return fail("HR profile not found.", 404)
    return ok(profile.to_dict(include_email=User.query.get(profile.user_id).email))


@employer_bp.put("/profile")
@jwt_required()
@role_required("employer")
def update_employer_profile():
    profile = _hr_profile()
    if not profile:
        return fail("HR profile not found.", 404)
    try:
        data = HRProfileSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid profile data.", 400, err.messages)

    before = {field: getattr(profile, field) for field in data}
    for field, value in data.items():
        setattr(profile, field, value)
    after = {field: getattr(profile, field) for field in data}
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "employer_profile", profile.id, before=before, after=after)
    return ok(profile.to_dict(), "Profile updated.")


@employer_bp.post("/profile/picture")
@jwt_required()
@role_required("employer")
def upload_hr_picture():
    from services.storage_service import upload_file, validate_upload_file

    profile = _hr_profile()
    if not profile:
        return fail("HR profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)
    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    profile.profile_picture_url = upload_file(
        file_bytes, file.filename, folder=f"hr-profile-pictures/{profile.id}", content_type=file.mimetype
    )
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "employer_profile", profile.id, "Profile picture uploaded")
    return ok(profile.to_dict(), "Profile picture updated.")


@employer_bp.post("/profile/documents")
@jwt_required()
@role_required("employer")
def upload_hr_document():
    from services.storage_service import upload_file, validate_upload_file

    profile = _hr_profile()
    if not profile:
        return fail("HR profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    document_type = request.form.get("document_type")
    if document_type not in HR_DOCUMENT_TYPES:
        return fail("Invalid document type.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    file_url = upload_file(
        file_bytes, file.filename, folder=f"hr-docs/{profile.id}/{document_type}", content_type=file.mimetype
    )
    EmployerHRDocument.query.filter_by(employer_hr_profile_id=profile.id, document_type=document_type).delete()
    db.session.add(EmployerHRDocument(
        employer_hr_profile_id=profile.id, document_type=document_type, file_url=file_url,
        original_filename=file.filename, status="pending_review",
    ))
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "employer_profile", profile.id, f"Document uploaded: {document_type}")
    return ok(profile.to_dict(), "Document uploaded for PESO Staff review.")


@employer_bp.delete("/profile/documents/<document_id>")
@jwt_required()
@role_required("employer")
def delete_hr_document(document_id):
    profile = _hr_profile()
    if not profile:
        return fail("HR profile not found.", 404)
    document = EmployerHRDocument.query.filter_by(id=document_id, employer_hr_profile_id=profile.id).first()
    if not document:
        return fail("Document not found.", 404)

    document_type = document.document_type
    db.session.delete(document)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "employer_profile", profile.id, f"Document removed: {document_type}")
    return ok(profile.to_dict(), "Document removed.")


# ---------- Company Profile ----------

# All company document types are single-instance (re-uploading replaces the prior
# row, same convention as jobseeker's SINGLE_INSTANCE_DOCUMENT_TYPES) — none of them
# are a "may have several" case like jobseeker training certificates.
GENERIC_COMPANY_DOCUMENT_TYPES = tuple(t for t in COMPANY_DOCUMENT_TYPES if t != "company_logo")


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
    try:
        data = CompanyProfileSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid company profile data.", 400, err.messages)

    before = {field: getattr(company, field) for field in data}
    for field, value in data.items():
        setattr(company, field, value)
    after = {field: getattr(company, field) for field in data}
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id, before=before, after=after)
    return ok(company.to_dict(), "Company profile updated.")


@company_bp.post("/logo")
@jwt_required()
@role_required("employer")
def upload_logo():
    from services.storage_service import upload_file, validate_upload_file

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)
    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    company.logo_url = upload_file(file_bytes, file.filename, folder=f"logos/{company.id}", content_type=file.mimetype)

    # The logo doubles as the mandatory "Company Logo" document (req. 2 lists it in
    # both Basic Information and Required Documents) — one upload satisfies both, no
    # separate re-upload through the generic document dropzone. It's a cosmetic asset,
    # not a compliance document, so it's auto-verified rather than queued for staff review.
    EmployerCompanyDocument.query.filter_by(employer_company_id=company.id, document_type="company_logo").delete()
    db.session.add(EmployerCompanyDocument(
        employer_company_id=company.id, document_type="company_logo", file_url=company.logo_url,
        original_filename=file.filename, status="verified",
    ))
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id, "Logo uploaded")
    return ok(company.to_dict(), "Logo uploaded.")


@company_bp.post("/signature")
@jwt_required()
@role_required("employer")
def upload_signature():
    from services.storage_service import upload_file, validate_upload_file

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)
    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    company.rep_signature_url = upload_file(
        file_bytes, file.filename, folder=f"signatures/{company.id}", content_type=file.mimetype
    )
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id, "Representative signature uploaded")
    return ok(company.to_dict(), "Signature uploaded.")


@company_bp.post("/documents")
@jwt_required()
@role_required("employer")
def upload_documents():
    from services.storage_service import upload_file, validate_upload_file

    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    document_type = request.form.get("document_type")
    if document_type not in GENERIC_COMPANY_DOCUMENT_TYPES:
        return fail("Invalid document type.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    file_url = upload_file(
        file_bytes, file.filename, folder=f"company-docs/{company.id}/{document_type}", content_type=file.mimetype
    )
    EmployerCompanyDocument.query.filter_by(employer_company_id=company.id, document_type=document_type).delete()
    db.session.add(EmployerCompanyDocument(
        employer_company_id=company.id, document_type=document_type, file_url=file_url,
        original_filename=file.filename, status="pending_review",
    ))
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id, f"Document uploaded: {document_type}")
    return ok(company.to_dict(), "Document uploaded for PESO Staff review.")


@company_bp.delete("/documents/<document_id>")
@jwt_required()
@role_required("employer")
def delete_company_document(document_id):
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    document = EmployerCompanyDocument.query.filter_by(id=document_id, employer_company_id=company.id).first()
    if not document:
        return fail("Document not found.", 404)
    if company.accreditation_status == "pending_review":
        return fail("Cannot remove a document while accreditation is under review. Replace it instead.", 400)

    document_type = document.document_type
    db.session.delete(document)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "company", company.id, f"Document removed: {document_type}")
    return ok(company.to_dict(), "Document removed.")


@company_bp.post("/submit-accreditation")
@jwt_required()
@role_required("employer")
def submit_accreditation():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)
    if company.accreditation_status not in ("not_submitted", "rejected"):
        return fail(f"Accreditation cannot be submitted from status '{company.accreditation_status}'.", 400)

    completion = compute_completion(company, COMPANY_REQUIRED_FIELDS)
    if completion["profile_completion"] < 100:
        return fail(
            "Complete every required field and document before submitting for accreditation.",
            400, {"missing_fields": completion["missing_fields"]},
        )

    company.accreditation_status = "pending_review"
    db.session.commit()
    notify_role("staff", "employer:accreditation_submitted", {"employer_id": str(company.id), "company_name": company.company_name})
    log_audit(User.query.get(company.user_id), "Update", "employers", company.id, "Submitted for accreditation")
    return ok(company.to_dict(), "Submitted for PESO/Admin accreditation review.")


# ---------- Vacancy Management ----------

# Fields whose change on an approved/published vacancy is significant enough to
# force a re-review — everything else (contact person, additional info, screening
# questions) can be edited freely post-approval with no status change.
CORE_VACANCY_FIELDS = (
    "title", "summary", "responsibilities", "daily_tasks", "description", "requirements",
    "required_skills", "education_level", "min_experience_years", "salary_min", "salary_max", "num_slots",
)


def _apply_vacancy_fields(vacancy, data):
    from utils.html_sanitizer import sanitize_html

    for field in (
        "title", "category_id", "industry", "department", "vacancy_no", "num_slots", "job_type",
        "work_arrangement", "schedule", "education_level", "course", "min_experience_years", "fresh_grad_ok",
        "required_skills", "required_certifications", "salary_min", "salary_max", "hide_salary", "benefits",
        "work_location", "region_code", "region_name", "province_code", "province_name",
        "city_municipality_code", "city_municipality_name", "barangay_code", "barangay_name",
        "street_address", "zip_code", "posting_date", "application_deadline", "expected_start_date",
        "pref_age_min", "pref_age_max", "pref_gender", "pref_civil_status", "pref_languages",
        "fresh_grad_friendly", "pwd_friendly", "senior_citizen_friendly", "ofw_friendly",
        "required_applicant_documents", "contact_name", "contact_email", "contact_number",
        "culture_description", "career_growth_description", "additional_notes", "description", "requirements",
    ):
        if field in data:
            setattr(vacancy, field, data[field])

    for field in ("summary", "responsibilities", "daily_tasks"):
        if field in data:
            setattr(vacancy, field, sanitize_html(data[field]))

    if "required_skills" in data:
        vacancy.skills_required = ", ".join(data["required_skills"] or [])

    if "screening_questions" in data:
        VacancyScreeningQuestion.query.filter_by(vacancy_id=vacancy.id).delete()
        for i, q in enumerate(data["screening_questions"] or []):
            db.session.add(VacancyScreeningQuestion(
                vacancy_id=vacancy.id, question_text=q["question_text"], question_type=q.get("question_type", "text"),
                options=q.get("options"), is_required=q.get("is_required", True), display_order=q.get("display_order", i),
            ))


@vacancies_bp.get("/<vacancy_id>")
@jwt_required()
@role_required("employer")
def get_my_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    return ok(vacancy.to_dict())


@vacancies_bp.get("/my")
@jwt_required()
@role_required("employer")
def my_vacancies():
    company = _company()
    if not company:
        return ok([])
    vacancies = (
        Vacancy.query.filter_by(employer_company_id=company.id, is_template=False)
        .filter(Vacancy.deleted_at.is_(None))
        .order_by(Vacancy.created_at.desc()).all()
    )
    return ok([v.to_dict() for v in vacancies])


@vacancies_bp.get("/templates")
@jwt_required()
@role_required("employer")
def list_vacancy_templates():
    company = _company()
    if not company:
        return ok([])
    templates = Vacancy.query.filter_by(employer_company_id=company.id, is_template=True).order_by(Vacancy.created_at.desc()).all()
    return ok([v.to_dict() for v in templates])


@vacancies_bp.get("/categories")
@jwt_required()
def list_vacancy_categories():
    categories = VacancyCategory.query.filter_by(is_active=True).order_by(VacancyCategory.name).all()
    return ok([c.to_dict() for c in categories])


@vacancies_bp.post("/suggest-skills")
@jwt_required()
@role_required("employer")
def suggest_skills():
    from services.nlp_service import SKILL_KEYWORDS

    data = request.get_json(force=True) or {}
    text = " ".join(filter(None, [data.get("description", ""), data.get("summary", ""), data.get("responsibilities", "")])).lower()
    matched = [kw.title() for kw in SKILL_KEYWORDS if kw in text]
    return ok({"suggested_skills": matched})


@vacancies_bp.post("")
@jwt_required()
@role_required("employer")
def create_vacancy():
    """Save Draft — no accreditation gate here; only Submit for Approval requires
    the company to be accredited (drafting is allowed while awaiting review)."""
    company = _company()
    if not company:
        return fail("Complete your company profile before posting a vacancy.", 400)

    try:
        data = VacancyWriteSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid vacancy data.", 400, err.messages)

    vacancy = Vacancy(employer_company_id=company.id, title=data.get("title") or "", status="draft")
    db.session.add(vacancy)
    db.session.flush()
    _apply_vacancy_fields(vacancy, data)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "vacancies", vacancy.id, "Draft saved")
    return ok(vacancy.to_dict(), "Draft saved.", 201)


@vacancies_bp.put("/<vacancy_id>")
@jwt_required()
@role_required("employer")
def update_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if vacancy.status in ("closed", "filled", "suspended"):
        return fail(f"This vacancy can no longer be edited (status: {vacancy.status}).", 400)

    try:
        data = VacancyWriteSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid vacancy data.", 400, err.messages)

    before = {"status": vacancy.status}
    core_field_changed = any(
        field in data and str(getattr(vacancy, field)) != str(data[field]) for field in CORE_VACANCY_FIELDS
    )
    _apply_vacancy_fields(vacancy, data)

    reverted_to_pending = False
    if core_field_changed and vacancy.status in ("approved", "published"):
        vacancy.status = "pending"
        reverted_to_pending = True

    db.session.commit()
    if reverted_to_pending:
        notify_role("staff", "vacancy:submitted", {"vacancy_id": str(vacancy.id), "title": vacancy.title})
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, before=before, after={"status": vacancy.status})
    message = "Vacancy updated. Core changes require re-approval." if reverted_to_pending else "Vacancy updated."
    return ok(vacancy.to_dict(), message)


@vacancies_bp.post("/<vacancy_id>/submit")
@jwt_required()
@role_required("employer")
def submit_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "pending", "employer"):
        return fail(f"Cannot submit a vacancy from status '{vacancy.status}'.", 400)
    if company.accreditation_status != "accredited":
        return fail("Your company must be accredited by PESO/Admin before submitting vacancies for approval.", 403)
    if not vacancy.title:
        return fail("Job title is required before submitting.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "pending"
    vacancy.submitted_at = now_manila()
    db.session.commit()
    notify_role("staff", "vacancy:submitted", {"vacancy_id": str(vacancy.id), "title": vacancy.title})
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, "Submitted for approval", before=before, after={"status": vacancy.status})
    return ok(vacancy.to_dict(), "Vacancy submitted for PESO Staff approval.")


@vacancies_bp.post("/<vacancy_id>/publish")
@jwt_required()
@role_required("employer")
def publish_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "published", "employer"):
        return fail(f"Cannot publish a vacancy from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "published"
    vacancy.published_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, "Published", before=before, after={"status": vacancy.status})
    return ok(vacancy.to_dict(), "Vacancy published.")


@vacancies_bp.post("/<vacancy_id>/close")
@jwt_required()
@role_required("employer")
def close_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "closed", "employer"):
        return fail(f"Cannot close a vacancy from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "closed"
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, "Closed", before=before, after={"status": vacancy.status})
    return ok(vacancy.to_dict(), "Vacancy closed.")


@vacancies_bp.post("/<vacancy_id>/reopen")
@jwt_required()
@role_required("employer")
def reopen_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "published", "employer"):
        return fail(f"Cannot reopen a vacancy from status '{vacancy.status}'.", 400)
    if company.accreditation_status != "accredited":
        return fail("Your company must be accredited by PESO/Admin to reopen vacancies.", 403)

    before = {"status": vacancy.status}
    vacancy.status = "published"
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, "Reopened", before=before, after={"status": vacancy.status})
    return ok(vacancy.to_dict(), "Vacancy reopened.")


@vacancies_bp.post("/<vacancy_id>/mark-filled")
@jwt_required()
@role_required("employer")
def mark_vacancy_filled(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "filled", "employer"):
        return fail(f"Cannot mark a vacancy filled from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "filled"
    vacancy.filled_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "vacancies", vacancy.id, "Marked filled", before=before, after={"status": vacancy.status})
    return ok(vacancy.to_dict(), "Vacancy marked as filled.")


@vacancies_bp.delete("/<vacancy_id>")
@jwt_required()
@role_required("employer")
def delete_vacancy(vacancy_id):
    company = _company()
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not company or vacancy.employer_company_id != company.id or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if vacancy.status != "draft":
        return fail("Only draft vacancies can be deleted. Close a published vacancy instead.", 400)
    if Application.query.filter_by(vacancy_id=vacancy.id).count() > 0:
        return fail("This vacancy already has applicants and cannot be deleted.", 400)

    db.session.delete(vacancy)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Delete", "vacancies", vacancy_id, "Draft deleted")
    return ok(message="Draft vacancy deleted.")


@vacancies_bp.post("/<vacancy_id>/duplicate")
@jwt_required()
@role_required("employer")
def duplicate_vacancy(vacancy_id):
    company = _company()
    original = Vacancy.query.get(vacancy_id)
    if not original or not company or original.employer_company_id != company.id:
        return fail("Vacancy not found.", 404)

    copy_fields = {c.name: getattr(original, c.name) for c in Vacancy.__table__.columns if c.name not in (
        "id", "created_at", "updated_at", "status", "title", "approved_by", "approved_at", "published_at", "filled_at",
        "submitted_at", "deleted_at", "rejection_remarks", "suspended_reason", "is_template", "template_name",
        "duplicated_from_id",
    )}
    duplicate = Vacancy(**copy_fields, status="draft", title=f"{original.title} (Copy)", duplicated_from_id=original.id)
    db.session.add(duplicate)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "vacancies", duplicate.id, f"Duplicated from {original.id}")
    return ok(duplicate.to_dict(), "Vacancy duplicated as a new draft.", 201)


@vacancies_bp.post("/<vacancy_id>/save-template")
@jwt_required()
@role_required("employer")
def save_vacancy_template(vacancy_id):
    company = _company()
    original = Vacancy.query.get(vacancy_id)
    if not original or not company or original.employer_company_id != company.id:
        return fail("Vacancy not found.", 404)
    data = request.get_json(force=True) or {}
    template_name = data.get("template_name")
    if not template_name:
        return fail("A template name is required.", 400)

    copy_fields = {c.name: getattr(original, c.name) for c in Vacancy.__table__.columns if c.name not in (
        "id", "created_at", "updated_at", "status", "approved_by", "approved_at", "published_at", "filled_at",
        "submitted_at", "deleted_at", "rejection_remarks", "suspended_reason", "is_template", "template_name",
        "duplicated_from_id",
    )}
    template = Vacancy(**copy_fields, status="draft", is_template=True, template_name=template_name)
    db.session.add(template)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "vacancies", template.id, f"Saved as template: {template_name}")
    return ok(template.to_dict(), "Saved as template.", 201)


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

    before = {"status": application.status}
    application.status = new_status
    if "feedback_note" in data:
        application.feedback_note = data["feedback_note"]
    if "employer_notes" in data:
        application.employer_notes = data["employer_notes"]
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "applications", application.id, before=before, after={"status": new_status})

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
    actor = User.query.get(get_jwt_identity())
    for a in apps:
        log_audit(actor, "Update", "applications", a.id, "Bulk rejected", after={"status": "rejected"})
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
