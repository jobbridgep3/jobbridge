import uuid
from datetime import datetime, timedelta

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from marshmallow import ValidationError
from sqlalchemy import case, func

from extensions import db
from models.application import Application
from models.audit import AuditTrail
from models.employer import COMPANY_MANDATORY_DOCUMENT_TYPES, EmployerCompany, EmployerCompanyDocument
from models.employer_hr import EmployerHRProfile
from models.employment import EmploymentRecord
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.program import ProgramApplication
from models.referral import ReferralLetter
from models.user import User
from models.vacancy import Vacancy
from schemas.jobseeker_schemas import ProfileUpdateSchema
from services.audit_service import log_audit
from services.dashboard_service import (
    build_analytics,
    build_dashboard_excel,
    build_dashboard_pdf,
    build_summary,
    build_vacancy_analytics,
)
from services.email_service import send_accreditation_status_email, send_verification_status_email
from services.employer_query_service import build_employer_query
from services.excel_service import build_excel_report
from services.notification_service import notify_role, notify_user
from services.pdf_service import generate_referral_letter, generate_table_report, to_bytesio
from services.profile_completion_service import COMPANY_REQUIRED_FIELDS, compute_completion
from services.profile_service import apply_document_upload, apply_profile_update, find_document
from services.storage_service import upload_file
from services.user_deletion_service import employer_dependent_counts, jobseeker_dependent_counts
from services.vacancy_query_service import build_vacancy_query
from services.vacancy_state_service import can_transition
from sockets.events import emit_to_role
from utils.decorators import role_required
from utils.pagination import paginate
from utils.responses import fail, ok
from utils.timezone import now_manila

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")


# ---------- Dashboard ----------

@staff_bp.get("/dashboard-stats")
@jwt_required()
@role_required("staff", "admin")
def dashboard_stats():
    return ok({
        "total_jobseekers": JobseekerProfile.query.count(),
        "total_employers": EmployerCompany.query.count(),
        "active_vacancies": Vacancy.query.filter_by(status="published").count(),
        "placements_this_month": EmploymentRecord.query.filter(
            EmploymentRecord.start_date >= datetime.utcnow().replace(day=1).date()
        ).count(),
    })


@staff_bp.get("/dashboard/summary")
@jwt_required()
@role_required("staff", "admin")
def staff_dashboard_summary():
    return ok(build_summary())


@staff_bp.get("/dashboard/analytics")
@jwt_required()
@role_required("staff", "admin")
def staff_dashboard_analytics():
    months = int(request.args.get("months", 6))
    return ok(build_analytics(months, request.args.get("date_from"), request.args.get("date_to")))


@staff_bp.get("/dashboard/export/excel")
@jwt_required()
@role_required("staff", "admin")
def staff_export_dashboard_excel():
    buf = build_dashboard_excel(request.args)
    log_audit(User.query.get(get_jwt_identity()), "Export", "dashboard")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="dashboard_report.xlsx")


@staff_bp.get("/dashboard/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def staff_export_dashboard_pdf():
    actor = User.query.get(get_jwt_identity())
    pdf_bytes = build_dashboard_pdf(request.args, actor.email)
    log_audit(actor, "Export", "dashboard")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="dashboard_report.pdf")


@staff_bp.get("/pending-approvals")
@jwt_required()
@role_required("staff", "admin")
def pending_approvals():
    return ok({
        "vacancies_pending": Vacancy.query.filter_by(status="pending").count(),
        "employers_pending": EmployerCompany.query.filter_by(accreditation_status="pending_review").count(),
        "spes_pending": ProgramApplication.query.filter_by(program_type="spes", status="submitted").count(),
        "dilp_pending": ProgramApplication.query.filter_by(program_type="dilp", status="submitted").count(),
        "owwa_pending": ProgramApplication.query.filter_by(program_type="owwa", status="submitted").count(),
    })


# ---------- Jobseeker Management ----------

@staff_bp.get("/jobseekers")
@jwt_required()
@role_required("staff", "admin")
def list_jobseekers():
    query = JobseekerProfile.query.options(db.joinedload(JobseekerProfile.user))
    if request.args.get("q"):
        query = query.filter(JobseekerProfile.full_name.ilike(f"%{request.args['q']}%"))
    profiles = query.order_by(JobseekerProfile.created_at.desc()).all()
    return ok([{**p.to_dict(), "is_active": p.user.is_active} for p in profiles])


@staff_bp.get("/jobseekers/<profile_id>")
@jwt_required()
@role_required("staff", "admin")
def get_jobseeker(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    user = User.query.get(profile.user_id)
    result = profile.to_dict(include_email=user.email)
    result["is_active"] = user.is_active
    result["applications"] = [a.to_dict() for a in Application.query.filter_by(jobseeker_profile_id=profile.id).all()]
    return ok(result)


@staff_bp.put("/jobseekers/<profile_id>/verify")
@jwt_required()
@role_required("staff", "admin")
def verify_jobseeker(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    user = User.query.get(profile.user_id)
    data = request.get_json(force=True) or {}
    approve = data.get("approve", True)

    if approve:
        # Defense-in-depth: the frontend disables the Verify button below 100%, but a
        # direct API call must be blocked too.
        if profile.profile_completion() < 100:
            return fail("Profile must be 100% complete before it can be verified.", 400)
        profile.is_verified_by_staff = True
        profile.verification_remarks = None
        status_label = "verified"
    else:
        remarks = (data.get("remarks") or "").strip()
        if not remarks:
            return fail("A reason is required when marking a profile as not verified.", 400)
        profile.is_verified_by_staff = False
        profile.verification_remarks = remarks
        status_label = "not verified"

    db.session.commit()
    notify_user(
        profile.user_id, "account_verified", "Profile Verification Update",
        f"Your profile has been marked {status_label}." + (f" Reason: {profile.verification_remarks}" if not approve else ""),
        socket_event="account:verified", socket_payload={"profile_id": str(profile.id), "status": status_label},
    )
    send_verification_status_email(user.email, profile.full_name, approve, profile.verification_remarks)
    log_audit(User.query.get(get_jwt_identity()), "Approve" if approve else "Reject", "jobseekers", profile.id)
    return ok(profile.to_dict(), f"Jobseeker {status_label}.")


@staff_bp.put("/jobseekers/<profile_id>/tags")
@jwt_required()
@role_required("staff", "admin")
def tag_jobseeker(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    data = request.get_json(force=True) or {}
    profile.tags = data.get("tags", [])
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobseekers", profile.id, f"Tags updated: {profile.tags}")
    return ok(profile.to_dict(), "Tags updated.")


@staff_bp.put("/jobseekers/<profile_id>/deactivate")
@jwt_required()
@role_required("staff", "admin")
def deactivate_jobseeker(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    user = User.query.get(profile.user_id)
    user.is_active = not user.is_active
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobseekers", profile.id, f"is_active={user.is_active}")
    result = profile.to_dict()
    result["is_active"] = user.is_active
    message = "Account has been activated successfully." if user.is_active else "Account has been deactivated successfully."
    return ok(result, message)


@staff_bp.delete("/jobseekers/<profile_id>")
@jwt_required()
@role_required("admin")
def delete_jobseeker(profile_id):
    """Permanently deletes a jobseeker account. Admin-only — the decorator above is
    the actual security boundary, not a UI hide. Blocked when the account has any
    real activity history (applications, employment, program/job-fair/training
    records) — this is a government record-keeping system, so those records must be
    preserved; deactivate the account instead in that case."""
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    user = User.query.get(profile.user_id)
    if str(user.id) == get_jwt_identity():
        return fail("You cannot delete your own account.", 403)

    dependent_counts = jobseeker_dependent_counts(profile.id)
    if any(dependent_counts.values()):
        return fail(
            "This jobseeker has existing activity records (applications, employment, "
            "program applications, job fair, or training history) and cannot be "
            "permanently deleted. Deactivate the account instead to preserve required records.",
            409, dependent_counts,
        )

    email = user.email
    db.session.delete(user)  # cascades to JobseekerProfile via User's "all, delete-orphan" relationship
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "jobseekers", profile_id,
              f"Permanently deleted jobseeker account {email}")
    return ok(message="Jobseeker account permanently deleted.")


JOBSEEKER_EXPORT_COLUMNS = [
    "Full Name", "Email", "Contact Number", "Address", "Barangay", "Municipality", "Province",
    "Date Registered", "Highest Educational Attainment", "Technical Skills", "Soft Skills", "Certifications",
    "Employment Status", "Resume Status", "Verification Status", "Active Status", "Profile Completion",
]


def _jobseeker_export_query(args):
    query = db.session.query(JobseekerProfile, User).join(User, User.id == JobseekerProfile.user_id)

    date_from = args.get("date_from")
    date_to = args.get("date_to")
    verification_status = args.get("verification_status")
    is_active_param = args.get("is_active")
    barangay = args.get("barangay")
    municipality = args.get("municipality")
    employment_status = args.get("employment_status")

    if date_from:
        query = query.filter(JobseekerProfile.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(JobseekerProfile.created_at < datetime.fromisoformat(date_to) + timedelta(days=1))
    if verification_status == "verified":
        query = query.filter(JobseekerProfile.is_verified_by_staff.is_(True))
    elif verification_status == "unverified":
        query = query.filter(JobseekerProfile.is_verified_by_staff.is_(False))
    if is_active_param == "true":
        query = query.filter(User.is_active.is_(True))
    elif is_active_param == "false":
        query = query.filter(User.is_active.is_(False))
    if barangay:
        query = query.filter(JobseekerProfile.barangay.ilike(f"%{barangay}%"))
    if municipality:
        query = query.filter(JobseekerProfile.municipality.ilike(f"%{municipality}%"))
    if employment_status:
        query = query.filter(JobseekerProfile.employment_status == employment_status)
    return query.order_by(JobseekerProfile.created_at.desc())


def _jobseeker_export_rows(args):
    rows = []
    for p, u in _jobseeker_export_query(args).all():
        highest_education = max(p.educations, key=lambda e: e.graduation_year or 0).attainment_level if p.educations else ""
        rows.append([
            p.full_name, u.email, p.contact_number or "", p.address or "",
            p.barangay or "", p.municipality or "", p.province or "",
            p.created_at.strftime("%Y-%m-%d"), highest_education or "",
            ", ".join(p.technical_skills or []), ", ".join(p.soft_skills or []), ", ".join(p.certifications or []),
            p.employment_status or "", "Uploaded" if p.resume_url else "Not Uploaded",
            "Verified" if p.is_verified_by_staff else "Unverified",
            "Active" if u.is_active else "Inactive",
            f"{p.profile_completion()}%",
        ])
    return rows


@staff_bp.get("/jobseekers/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_jobseekers_excel():
    buf = build_excel_report("Job Seekers Export", JOBSEEKER_EXPORT_COLUMNS, _jobseeker_export_rows(request.args))
    log_audit(User.query.get(get_jwt_identity()), "Export", "jobseekers")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name="jobseekers_export.xlsx",
    )


@staff_bp.get("/jobseekers/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_jobseekers_pdf():
    pdf_bytes = generate_table_report(
        "Job Seekers Report", JOBSEEKER_EXPORT_COLUMNS, _jobseeker_export_rows(request.args), now_manila().strftime("%Y-%m-%d"),
    )
    log_audit(User.query.get(get_jwt_identity()), "Export", "jobseekers")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="jobseekers_export.pdf")


@staff_bp.put("/jobseekers/<profile_id>/profile")
@jwt_required()
@role_required("staff", "admin")
def update_jobseeker_profile(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    try:
        data = ProfileUpdateSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid profile data", 400, err.messages)

    apply_profile_update(profile, data)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobseekers", profile.id, "Profile edited by staff")
    return ok(profile.to_dict(), "Jobseeker profile updated.")


@staff_bp.post("/jobseekers/<profile_id>/documents")
@jwt_required()
@role_required("staff", "admin")
def staff_upload_jobseeker_document(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    document_type = request.form.get("document_type")
    error = apply_document_upload(profile, request.files["file"], document_type)
    if error:
        return fail(error, 400)

    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobseekers", profile.id, f"Document uploaded by staff: {document_type}")
    return ok(profile.to_dict(), "Document uploaded.")


@staff_bp.delete("/jobseekers/<profile_id>/documents/<document_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_delete_jobseeker_document(profile_id, document_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)

    document = find_document(profile, document_id)
    if not document:
        return fail("Document not found.", 404)

    document_type = document.document_type
    db.session.delete(document)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobseekers", profile.id, f"Document removed by staff: {document_type}")
    return ok(profile.to_dict(), "Document removed.")


@staff_bp.post("/referral-letter/<application_id>")
@jwt_required()
@role_required("staff", "admin")
def generate_referral(application_id):
    application = Application.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)

    staff_user = User.query.get(get_jwt_identity())
    pdf_bytes = generate_referral_letter(
        application.jobseeker_profile.full_name, application.vacancy.title,
        application.vacancy.employer_company.company_name, datetime.utcnow().strftime("%B %d, %Y"),
    )
    url = upload_file(pdf_bytes, "referral.pdf", folder=f"referrals/{application.id}", content_type="application/pdf")

    existing = ReferralLetter.query.filter_by(application_id=application.id).first()
    if existing:
        existing.pdf_url = url
    else:
        db.session.add(ReferralLetter(application_id=application.id, generated_by=staff_user.id, pdf_url=url))
    db.session.commit()

    notify_user(
        application.jobseeker_profile.user_id, "referral_ready", "Referral Letter Ready",
        f"Your referral letter for {application.vacancy.title} is ready to download.",
        link="/jobseeker/applications", socket_event="referral:ready",
        socket_payload={"application_id": str(application.id), "pdf_url": url},
    )
    log_audit(staff_user, "Generate", "referral_letters", application.id)
    return ok({"pdf_url": url}, "Referral letter generated.")


# ---------- Employer Management ----------

@staff_bp.get("/employers")
@jwt_required()
@role_required("staff", "admin")
def list_employers():
    query = build_employer_query(request.args).order_by(EmployerCompany.created_at.desc())
    result = paginate(query, request.args)
    return ok({
        "items": [c.to_dict() for c in result["items"]],
        "total": result["total"], "page": result["page"], "limit": result["limit"],
    })


EMPLOYER_EXPORT_COLUMNS = [
    "Company Name", "Business Type", "Industry", "Nature of Business", "Complete Address", "Region", "Province",
    "Municipality", "Barangay", "ZIP Code", "Company Email", "Contact Number", "Alt. Contact Number", "Website",
    "HR Representative", "Rep. Position", "Rep. Contact Number", "SEC No.", "DTI No.", "CDA No.", "BIR TIN",
    "Business Permit No.", "Accreditation Status", "Document Verification", "Registered Date",
    "Active Vacancies", "Total Applicants", "Total Hired", "Company Profile Completion",
]


def _employer_hire_stats():
    """One grouped query for hired/applicant totals per company, instead of an
    N+1 query per row in the export."""
    rows = (
        db.session.query(
            Vacancy.employer_company_id,
            func.count(Application.id),
            func.sum(case((Application.status == "hired", 1), else_=0)),
        )
        .join(Application, Application.vacancy_id == Vacancy.id)
        .group_by(Vacancy.employer_company_id)
        .all()
    )
    return {str(company_id): (total or 0, hired or 0) for company_id, total, hired in rows}


def _employer_export_rows(args):
    companies = build_employer_query(args).order_by(EmployerCompany.created_at.desc()).limit(20000).all()
    hire_stats = _employer_hire_stats()
    rows = []
    for c in companies:
        applicants, hired = hire_stats.get(str(c.id), (0, 0))
        mandatory_docs = [d for d in c.documents if d.document_type in COMPANY_MANDATORY_DOCUMENT_TYPES]
        verified_count = sum(1 for d in mandatory_docs if d.status == "verified")
        rows.append([
            c.company_name or "", (c.business_type or "").replace("_", " ").title(), c.industry or "",
            c.nature_of_business or "",
            ", ".join(filter(None, [c.street_address, c.barangay_name])) or "",
            c.region_name or "", c.province_name or "", c.city_municipality_name or "", c.barangay_name or "",
            c.zip_code or "", c.company_email or "", c.contact_number or "", c.alt_contact_number or "",
            c.website or "", c.rep_name or "", c.rep_position or "", c.rep_contact_number or "",
            c.sec_number or "", c.dti_number or "", c.cda_number or "", c.bir_tin or "", c.business_permit_no or "",
            c.accreditation_status.replace("_", " ").title(), f"{verified_count}/{len(mandatory_docs)} verified",
            c.created_at.strftime("%Y-%m-%d"), c.active_vacancies_count(), applicants, hired,
            f"{compute_completion(c, COMPANY_REQUIRED_FIELDS)['profile_completion']}%",
        ])
    return rows


@staff_bp.get("/employers/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_employers_excel():
    buf = build_excel_report("Employers", EMPLOYER_EXPORT_COLUMNS, _employer_export_rows(request.args))
    log_audit(User.query.get(get_jwt_identity()), "Export", "employers")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name=f"employers_export_{now_manila().strftime('%Y%m%d_%H%M%S')}.xlsx",
    )


@staff_bp.get("/employers/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_employers_pdf():
    pdf_bytes = generate_table_report(
        "Employers Report", EMPLOYER_EXPORT_COLUMNS, _employer_export_rows(request.args), now_manila().strftime("%Y-%m-%d"),
    )
    log_audit(User.query.get(get_jwt_identity()), "Export", "employers")
    return send_file(
        to_bytesio(pdf_bytes), mimetype="application/pdf",
        as_attachment=True, download_name=f"employers_export_{now_manila().strftime('%Y%m%d_%H%M%S')}.pdf",
    )


@staff_bp.get("/employers/<company_id>")
@jwt_required()
@role_required("staff", "admin")
def get_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    result = company.to_dict(include_email=User.query.get(company.user_id).email)
    result["vacancies"] = [v.to_dict() for v in Vacancy.query.filter_by(employer_company_id=company.id).all()]
    result["accreditation_history"] = [
        e.to_dict() for e in AuditTrail.query.filter_by(module="employers", record_id=str(company.id))
        .order_by(AuditTrail.created_at.desc()).all()
    ]
    hr_profile = EmployerHRProfile.query.filter_by(employer_company_id=company.id).first()
    result["hr_profile"] = hr_profile.to_dict(include_email=User.query.get(hr_profile.user_id).email) if hr_profile else None
    return ok(result)


@staff_bp.put("/employers/<company_id>/documents/<document_id>/review")
@jwt_required()
@role_required("staff", "admin")
def review_company_document(company_id, document_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    document = EmployerCompanyDocument.query.filter_by(id=document_id, employer_company_id=company.id).first()
    if not document:
        return fail("Document not found.", 404)

    data = request.get_json(force=True) or {}
    status = data.get("status")
    if status not in ("verified", "rejected"):
        return fail("Status must be 'verified' or 'rejected'.", 400)
    if status == "rejected" and not data.get("rejection_reason"):
        return fail("A rejection reason is required.", 400)

    before = {"status": document.status, "rejection_reason": document.rejection_reason}
    document.status = status
    document.rejection_reason = data.get("rejection_reason") if status == "rejected" else None
    document.reviewed_by = get_jwt_identity()
    document.reviewed_at = now_manila()
    after = {"status": document.status, "rejection_reason": document.rejection_reason}
    db.session.commit()

    doc_label = document.document_type.replace("_", " ").title()
    notify_user(
        company.user_id, "document_reviewed", f"Document {status.title()}",
        f"Your {doc_label} was {status}." + (f" Reason: {document.rejection_reason}" if status == "rejected" else ""),
        link="/employer/company", socket_event="document:verified" if status == "verified" else "document:rejected",
        socket_payload={"employer_id": str(company.id), "document_type": document.document_type, "status": status},
    )
    log_audit(
        User.query.get(get_jwt_identity()), "Approve" if status == "verified" else "Reject", "employers", company.id,
        f"{doc_label} document {status}", before=before, after=after,
    )
    return ok(company.to_dict(), "Document review updated.")


@staff_bp.put("/employers/<company_id>/verify")
@jwt_required()
@role_required("staff", "admin")
def verify_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    if company.accreditation_status != "pending_review":
        return fail(f"Cannot approve/reject from status '{company.accreditation_status}'. Employer must submit for accreditation first.", 400)

    data = request.get_json(force=True) or {}
    before = {"accreditation_status": company.accreditation_status}
    approve = data.get("approve", True)
    if approve:
        company.accreditation_status = "accredited"
        company.accreditation_remarks = None
    else:
        if not data.get("remarks"):
            return fail("Remarks are required when rejecting accreditation.", 400)
        company.accreditation_status = "rejected"
        company.accreditation_remarks = data.get("remarks")
    after = {"accreditation_status": company.accreditation_status}
    db.session.commit()
    notify_user(
        company.user_id, "account_verified", "Accreditation Update",
        f"Your company accreditation is now {company.accreditation_status.replace('_', ' ')}."
        + (f" Reason: {company.accreditation_remarks}" if not approve else ""),
        link="/employer/company", socket_event="account:verified",
        socket_payload={"employer_id": str(company.id), "status": company.accreditation_status},
    )
    send_accreditation_status_email(
        User.query.get(company.user_id).email, company.company_name, approve,
        remarks=company.accreditation_remarks if not approve else None,
    )
    log_audit(User.query.get(get_jwt_identity()), "Approve" if approve else "Reject", "employers", company.id, before=before, after=after)
    return ok(company.to_dict(), "Employer accreditation updated.")


@staff_bp.put("/employers/<company_id>/suspend")
@jwt_required()
@role_required("staff", "admin")
def suspend_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    if company.accreditation_status != "accredited":
        return fail(f"Only an accredited employer can be suspended (current status: '{company.accreditation_status}').", 400)

    before = {"accreditation_status": company.accreditation_status}
    company.accreditation_status = "suspended"
    after = {"accreditation_status": company.accreditation_status}
    db.session.commit()
    notify_user(company.user_id, "account_suspended", "Account Suspended", "Your company account has been suspended.",
                link="/employer/company", socket_event="account:suspended", socket_payload={"employer_id": str(company.id)})
    log_audit(User.query.get(get_jwt_identity()), "Update", "employers", company.id, "Suspended", before=before, after=after)
    return ok(company.to_dict(), "Employer suspended.")


@staff_bp.put("/employers/<company_id>/reinstate")
@jwt_required()
@role_required("admin")
def reinstate_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    if company.accreditation_status != "suspended":
        return fail(f"Only a suspended employer can be reinstated (current status: '{company.accreditation_status}').", 400)

    before = {"accreditation_status": company.accreditation_status}
    company.accreditation_status = "accredited"
    after = {"accreditation_status": company.accreditation_status}
    db.session.commit()
    notify_user(company.user_id, "account_verified", "Account Reinstated", "Your company account has been reinstated and is accredited again.",
                link="/employer/company", socket_event="account:verified",
                socket_payload={"employer_id": str(company.id), "status": company.accreditation_status})
    log_audit(User.query.get(get_jwt_identity()), "Update", "employers", company.id, "Reinstated", before=before, after=after)
    return ok(company.to_dict(), "Employer reinstated.")


@staff_bp.delete("/employers/<company_id>")
@jwt_required()
@role_required("admin")
def delete_employer(company_id):
    """Permanently deletes an employer account. Admin-only, same rules as
    delete_jobseeker above — blocked if the account has any job postings,
    employment records, or job-fair booth history."""
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    user = User.query.get(company.user_id)
    if str(user.id) == get_jwt_identity():
        return fail("You cannot delete your own account.", 403)

    dependent_counts = employer_dependent_counts(company.id)
    if any(dependent_counts.values()):
        return fail(
            "This employer has existing activity records (job postings, employment, "
            "or job fair history) and cannot be permanently deleted. Deactivate/suspend "
            "the account instead to preserve required records.",
            409, dependent_counts,
        )

    email = user.email
    db.session.delete(user)  # cascades to EmployerCompany via User's "all, delete-orphan" relationship
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "employers", company_id,
              f"Permanently deleted employer account {email}")
    return ok(message="Employer account permanently deleted.")


# ---------- Job Vacancy Management ----------

@staff_bp.get("/vacancies")
@jwt_required()
@role_required("staff", "admin")
def staff_list_vacancies():
    query = build_vacancy_query(request.args).order_by(Vacancy.created_at.desc())
    result = paginate(query, request.args)
    return ok({
        "items": [v.to_dict() for v in result["items"]],
        "total": result["total"], "page": result["page"], "limit": result["limit"],
    })


@staff_bp.get("/vacancies/summary")
@jwt_required()
@role_required("staff", "admin")
def staff_vacancy_summary():
    base = Vacancy.query.filter(Vacancy.deleted_at.is_(None))
    return ok({
        "total": base.count(),
        "draft": base.filter_by(status="draft").count(),
        "pending": base.filter_by(status="pending").count(),
        "approved": base.filter_by(status="approved").count(),
        "published": base.filter_by(status="published").count(),
        "rejected": base.filter_by(status="rejected").count(),
        "suspended": base.filter_by(status="suspended").count(),
        "closed": base.filter_by(status="closed").count(),
        "filled": base.filter_by(status="filled").count(),
    })


@staff_bp.get("/vacancies/analytics")
@jwt_required()
@role_required("staff", "admin")
def staff_vacancy_analytics():
    months = int(request.args.get("months", 6))
    return ok(build_vacancy_analytics(months))


VACANCY_EXPORT_COLUMNS = [
    "Vacancy No.", "Job Title", "Employer", "Category", "Industry", "Salary Range", "Employment Type",
    "Work Arrangement", "Region", "Province", "Municipality", "Barangay", "Date Posted", "Application Deadline",
    "Openings", "Applicant Count", "Hiring/Approval Status", "Last Updated",
]


def _format_salary(v):
    if v.hide_salary:
        return "Not disclosed"
    if v.salary_min and v.salary_max:
        return f"P{float(v.salary_min):,.0f} - P{float(v.salary_max):,.0f}"
    if v.salary_min:
        return f"From P{float(v.salary_min):,.0f}"
    if v.salary_max:
        return f"Up to P{float(v.salary_max):,.0f}"
    return ""


def _scoped_vacancy_query(args):
    scope = args.get("scope", "all")
    query = build_vacancy_query(args).order_by(Vacancy.created_at.desc())
    if scope == "selected":
        ids = args.get("ids", "")
        query = query.filter(Vacancy.id.in_(ids.split(",") if ids else []))
    elif scope == "current_page":
        page = max(int(args.get("page", 1)), 1)
        limit = min(int(args.get("limit", 50)), 200)
        query = query.offset((page - 1) * limit).limit(limit)
    return query.limit(20000).all()


def _vacancy_export_rows(args):
    return [
        [
            v.vacancy_no or "", v.title, v.employer_company.company_name if v.employer_company else "",
            v.category.name if v.category else "", v.industry or "", _format_salary(v),
            (v.job_type or "").replace("_", " ").title(), (v.work_arrangement or "").title(),
            v.region_name or "", v.province_name or "", v.city_municipality_name or "", v.barangay_name or "",
            v.created_at.strftime("%Y-%m-%d"),
            v.application_deadline.strftime("%Y-%m-%d") if v.application_deadline else "",
            v.num_slots, len(v.applications), v.status.replace("_", " ").title(),
            v.updated_at.strftime("%Y-%m-%d") if v.updated_at else "",
        ]
        for v in _scoped_vacancy_query(args)
    ]


@staff_bp.get("/vacancies/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_vacancies_excel():
    buf = build_excel_report("Vacancies", VACANCY_EXPORT_COLUMNS, _vacancy_export_rows(request.args))
    log_audit(User.query.get(get_jwt_identity()), "Export", "vacancies")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name=f"vacancies_export_{now_manila().strftime('%Y%m%d_%H%M%S')}.xlsx",
    )


@staff_bp.get("/vacancies/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_vacancies_pdf():
    pdf_bytes = generate_table_report(
        "Vacancies Report", VACANCY_EXPORT_COLUMNS, _vacancy_export_rows(request.args), now_manila().strftime("%Y-%m-%d"),
    )
    log_audit(User.query.get(get_jwt_identity()), "Export", "vacancies")
    return send_file(
        to_bytesio(pdf_bytes), mimetype="application/pdf",
        as_attachment=True, download_name=f"vacancies_export_{now_manila().strftime('%Y%m%d_%H%M%S')}.pdf",
    )


@staff_bp.get("/vacancies/<vacancy_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_get_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    result = vacancy.to_dict()
    applicants = [a.to_dict() for a in vacancy.applications]
    result["applicants"] = applicants
    status_counts = {}
    for a in applicants:
        status_counts[a["status"]] = status_counts.get(a["status"], 0) + 1
    result["applicant_stats"] = status_counts
    result["hiring_stats"] = {
        "total_applicants": len(applicants),
        "hired": status_counts.get("hired", 0),
        "days_since_posted": (now_manila().date() - vacancy.created_at.date()).days if vacancy.created_at else None,
    }
    result["audit_history"] = [
        e.to_dict() for e in AuditTrail.query.filter_by(module="vacancies", record_id=str(vacancy.id))
        .order_by(AuditTrail.created_at.desc()).all()
    ]
    return ok(result)


@staff_bp.get("/vacancies/<vacancy_id>/applicants/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_vacancy_applicants_excel(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    rows = [
        [a.jobseeker_profile.full_name, a.jobseeker_profile.contact_number or "", a.status, a.match_score or "", a.created_at.strftime("%Y-%m-%d")]
        for a in vacancy.applications
    ]
    buf = build_excel_report(
        f"Applicants - {vacancy.title}"[:31], ["Applicant Name", "Contact Number", "Status", "Match Score", "Applied Date"], rows,
    )
    log_audit(User.query.get(get_jwt_identity()), "Export", "vacancies", vacancy.id, "Exported applicants")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name=f"vacancy_{vacancy_id}_applicants.xlsx",
    )


@staff_bp.put("/vacancies/<vacancy_id>/approve")
@jwt_required()
@role_required("staff", "admin")
def approve_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "approved", "staff"):
        return fail(f"Cannot approve a vacancy from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "approved"
    vacancy.approved_by = get_jwt_identity()
    vacancy.approved_at = now_manila()
    after = {"status": vacancy.status}
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_approved", "Vacancy Approved",
                f"{vacancy.title} has been approved. Publish it to make it visible to jobseekers.", socket_event="vacancy:approved",
                socket_payload={"vacancy_id": str(vacancy.id)})
    log_audit(User.query.get(get_jwt_identity()), "Approve", "vacancies", vacancy.id, before=before, after=after)
    return ok(vacancy.to_dict(), "Vacancy approved.")


@staff_bp.put("/vacancies/<vacancy_id>/reject")
@jwt_required()
@role_required("staff", "admin")
def reject_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "rejected", "staff"):
        return fail(f"Cannot reject a vacancy from status '{vacancy.status}'.", 400)

    data = request.get_json(force=True) or {}
    before = {"status": vacancy.status}
    vacancy.status = "rejected"
    vacancy.rejection_remarks = data.get("remarks", "")
    after = {"status": vacancy.status}
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_rejected", "Vacancy Returned",
                vacancy.rejection_remarks, socket_event="vacancy:rejected",
                socket_payload={"vacancy_id": str(vacancy.id), "remarks": vacancy.rejection_remarks})
    log_audit(User.query.get(get_jwt_identity()), "Reject", "vacancies", vacancy.id, before=before, after=after)
    return ok(vacancy.to_dict(), "Vacancy rejected.")


@staff_bp.put("/vacancies/<vacancy_id>/suspend")
@jwt_required()
@role_required("staff", "admin")
def suspend_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "suspended", "staff"):
        return fail(f"Cannot suspend a vacancy from status '{vacancy.status}'.", 400)

    data = request.get_json(force=True) or {}
    before = {"status": vacancy.status}
    vacancy.status = "suspended"
    vacancy.suspended_reason = data.get("reason", "")
    after = {"status": vacancy.status}
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_suspended", "Vacancy Suspended",
                f"{vacancy.title} has been suspended." + (f" Reason: {vacancy.suspended_reason}" if vacancy.suspended_reason else ""),
                socket_event="vacancy:suspended", socket_payload={"vacancy_id": str(vacancy.id)})
    log_audit(User.query.get(get_jwt_identity()), "Update", "vacancies", vacancy.id, "Suspended", before=before, after=after)
    return ok(vacancy.to_dict(), "Vacancy suspended.")


@staff_bp.put("/vacancies/<vacancy_id>/reactivate")
@jwt_required()
@role_required("admin")
def reactivate_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "published", "admin"):
        return fail(f"Cannot reactivate a vacancy from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "published"
    vacancy.suspended_reason = None
    after = {"status": vacancy.status}
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_reactivated", "Vacancy Reactivated",
                f"{vacancy.title} has been reactivated and is published again.",
                socket_event="vacancy:approved", socket_payload={"vacancy_id": str(vacancy.id)})
    log_audit(User.query.get(get_jwt_identity()), "Update", "vacancies", vacancy.id, "Reactivated", before=before, after=after)
    return ok(vacancy.to_dict(), "Vacancy reactivated.")


@staff_bp.put("/vacancies/<vacancy_id>/close")
@jwt_required()
@role_required("staff", "admin")
def staff_close_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)
    if not can_transition(vacancy.status, "closed", "staff"):
        return fail(f"Cannot close a vacancy from status '{vacancy.status}'.", 400)

    before = {"status": vacancy.status}
    vacancy.status = "closed"
    after = {"status": vacancy.status}
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "vacancies", vacancy.id, "Closed by staff", before=before, after=after)
    return ok(vacancy.to_dict(), "Vacancy closed.")


@staff_bp.delete("/vacancies/<vacancy_id>")
@jwt_required()
@role_required("admin")
def staff_delete_vacancy(vacancy_id):
    """Soft delete — admin can Restore it later, unlike the hard-delete used for
    employer/jobseeker accounts (this vacancy may have applicant history worth
    preserving, so the row is kept, just hidden from every normal listing)."""
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or vacancy.deleted_at:
        return fail("Vacancy not found.", 404)

    vacancy.deleted_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "vacancies", vacancy.id, f"Soft-deleted: {vacancy.title}")
    return ok(message="Vacancy deleted. It can be restored from the Admin panel.")


@staff_bp.put("/vacancies/<vacancy_id>/restore")
@jwt_required()
@role_required("admin")
def restore_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy or not vacancy.deleted_at:
        return fail("Vacancy not found or not deleted.", 404)

    vacancy.deleted_at = None
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "vacancies", vacancy.id, f"Restored: {vacancy.title}")
    return ok(vacancy.to_dict(), "Vacancy restored.")


@staff_bp.post("/vacancies/bulk-action")
@jwt_required()
@role_required("staff", "admin")
def bulk_vacancy_action():
    """Transaction-safe per item: one vacancy's failure doesn't roll back the
    others' success — the response reports exactly which ids succeeded/failed
    and why, rather than an all-or-nothing outcome."""
    data = request.get_json(force=True) or {}
    action = data.get("action")
    vacancy_ids = data.get("vacancy_ids", [])
    remarks = data.get("remarks", "")
    actor_role = get_jwt().get("role")
    actor = User.query.get(get_jwt_identity())

    action_to_status = {
        "approve": "approved", "reject": "rejected", "suspend": "suspended", "close": "closed",
    }
    if action == "delete" and actor_role != "admin":
        return fail("Only Admin can bulk-delete vacancies.", 403)
    if action not in (*action_to_status, "delete"):
        return fail("Invalid bulk action.", 400)

    succeeded, failed = [], []
    for vacancy_id in vacancy_ids:
        try:
            try:
                uuid.UUID(str(vacancy_id))
            except ValueError:
                failed.append({"id": vacancy_id, "reason": "Invalid vacancy ID."})
                continue

            vacancy = Vacancy.query.get(vacancy_id)
            if not vacancy or vacancy.deleted_at:
                failed.append({"id": vacancy_id, "reason": "Vacancy not found."})
                continue

            if action == "delete":
                vacancy.deleted_at = now_manila()
                log_audit(actor, "Delete", "vacancies", vacancy.id, "Bulk deleted")
            else:
                new_status = action_to_status[action]
                if not can_transition(vacancy.status, new_status, "staff" if action != "delete" else "admin"):
                    failed.append({"id": vacancy_id, "reason": f"Cannot {action} from status '{vacancy.status}'."})
                    continue
                if action == "reject" and not remarks:
                    failed.append({"id": vacancy_id, "reason": "Remarks are required to reject."})
                    continue
                before = {"status": vacancy.status}
                vacancy.status = new_status
                if action == "reject":
                    vacancy.rejection_remarks = remarks
                if action == "suspend":
                    vacancy.suspended_reason = remarks
                log_audit(actor, action.title(), "vacancies", vacancy.id, f"Bulk {action}", before=before, after={"status": new_status})
            db.session.commit()
            succeeded.append(vacancy_id)
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            failed.append({"id": vacancy_id, "reason": str(exc)})

    return ok({"succeeded": succeeded, "failed": failed}, f"{len(succeeded)} succeeded, {len(failed)} failed.")


@staff_bp.post("/vacancies")
@jwt_required()
@role_required("staff", "admin")
def staff_create_vacancy():
    """Manual add for walk-in employer without a system account — auto-published,
    same as before (walk-ins skip the draft/approval steps since staff is directly
    vouching for the posting)."""
    data = request.get_json(force=True) or {}
    company_id = data.get("employer_company_id")
    if not company_id:
        return fail("employer_company_id is required.", 400)
    now = now_manila()
    vacancy = Vacancy(
        employer_company_id=company_id, title=data.get("title", ""), description=data.get("description", ""),
        requirements=data.get("requirements"), skills_required=data.get("skills_required"),
        job_type=data.get("job_type"), num_slots=data.get("num_slots", 1), work_location=data.get("work_location"),
        status="published", is_manual_entry=True, approved_by=get_jwt_identity(), approved_at=now, published_at=now,
    )
    db.session.add(vacancy)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "vacancies", vacancy.id, "Manual walk-in vacancy entry")
    return ok(vacancy.to_dict(), "Vacancy added.", 201)


# ---------- Interview Oversight ----------

@staff_bp.get("/interviews")
@jwt_required()
@role_required("staff", "admin")
def staff_list_interviews():
    interviews = Interview.query.order_by(Interview.scheduled_date.desc()).all()
    return ok([i.to_dict() for i in interviews])


@staff_bp.get("/interviews/report")
@jwt_required()
@role_required("staff", "admin")
def interview_report():
    interviews = Interview.query.all()
    rows = [[i.application.jobseeker_profile.full_name, i.application.vacancy.title, i.status, str(i.scheduled_date)] for i in interviews]
    buf = build_excel_report("Interview Report", ["Jobseeker", "Position", "Status", "Date"], rows)
    log_audit(User.query.get(get_jwt_identity()), "Export", "interviews")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="interview_report.xlsx")


# ---------- Employment Monitoring ----------

@staff_bp.get("/employment")
@jwt_required()
@role_required("staff", "admin")
def staff_list_employment():
    query = EmploymentRecord.query
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    records = query.order_by(EmploymentRecord.start_date.desc()).all()
    return ok([r.to_dict() for r in records])


@staff_bp.put("/employment/<record_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_update_employment(record_id):
    record = EmploymentRecord.query.get(record_id)
    if not record:
        return fail("Record not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("position", "status", "termination_reason", "flagged_discrepancy"):
        if field in data:
            setattr(record, field, data[field])
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "employment", record.id)
    return ok(record.to_dict(), "Employment record updated.")


@staff_bp.post("/employment")
@jwt_required()
@role_required("staff", "admin")
def staff_create_employment():
    """Manual entry for walk-in placements not made through the system."""
    data = request.get_json(force=True) or {}
    record = EmploymentRecord(
        jobseeker_profile_id=data["jobseeker_profile_id"], employer_company_id=data["employer_company_id"],
        position=data.get("position", ""), start_date=datetime.fromisoformat(data["start_date"]).date(),
        status="active", is_walk_in=True,
    )
    db.session.add(record)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "employment", record.id, "Manual walk-in placement entry")
    return ok(record.to_dict(), "Employment record created.", 201)


@staff_bp.get("/employment/report")
@jwt_required()
@role_required("staff", "admin")
def employment_report():
    records = EmploymentRecord.query.all()
    rows = [[r.jobseeker_profile.full_name, r.employer_company.company_name, r.position, r.status, str(r.start_date)] for r in records]
    fmt = request.args.get("format", "excel")
    log_audit(User.query.get(get_jwt_identity()), "Export", "employment")
    if fmt == "pdf":
        pdf_bytes = generate_table_report("Employment Report", ["Jobseeker", "Employer", "Position", "Status", "Start Date"], rows, datetime.utcnow().strftime("%Y-%m-%d"))
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="employment_report.pdf")
    buf = build_excel_report("Employment Report", ["Jobseeker", "Employer", "Position", "Status", "Start Date"], rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="employment_report.xlsx")


# ---------- Activity feed ----------

@staff_bp.get("/activity-feed")
@jwt_required()
@role_required("staff", "admin")
def activity_feed():
    from models.audit import AuditTrail

    entries = AuditTrail.query.order_by(AuditTrail.created_at.desc()).limit(30).all()
    return ok([e.to_dict() for e in entries])
