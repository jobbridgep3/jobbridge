from datetime import datetime, timedelta

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.program import ProgramApplication
from models.referral import ReferralLetter
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.email_service import send_verification_status_email
from services.excel_service import build_excel_report
from services.notification_service import notify_role, notify_user
from services.pdf_service import generate_referral_letter, generate_table_report, to_bytesio
from services.storage_service import upload_file
from sockets.events import emit_to_role
from utils.decorators import role_required
from utils.responses import fail, ok

staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")


# ---------- Dashboard ----------

@staff_bp.get("/dashboard-stats")
@jwt_required()
@role_required("staff", "admin")
def dashboard_stats():
    return ok({
        "total_jobseekers": JobseekerProfile.query.count(),
        "total_employers": EmployerCompany.query.count(),
        "active_vacancies": Vacancy.query.filter_by(status="active").count(),
        "placements_this_month": EmploymentRecord.query.filter(
            EmploymentRecord.start_date >= datetime.utcnow().replace(day=1).date()
        ).count(),
    })


@staff_bp.get("/pending-approvals")
@jwt_required()
@role_required("staff", "admin")
def pending_approvals():
    return ok({
        "vacancies_pending": Vacancy.query.filter_by(status="pending").count(),
        "employers_pending": EmployerCompany.query.filter_by(verification_status="unverified").count(),
        "spes_pending": ProgramApplication.query.filter_by(program_type="spes", status="submitted").count(),
        "dilp_pending": ProgramApplication.query.filter_by(program_type="dilp", status="submitted").count(),
        "owwa_pending": ProgramApplication.query.filter_by(program_type="owwa", status="submitted").count(),
    })


# ---------- Jobseeker Management ----------

@staff_bp.get("/jobseekers")
@jwt_required()
@role_required("staff", "admin")
def list_jobseekers():
    query = JobseekerProfile.query
    if request.args.get("q"):
        query = query.filter(JobseekerProfile.full_name.ilike(f"%{request.args['q']}%"))
    profiles = query.order_by(JobseekerProfile.created_at.desc()).all()
    return ok([p.to_dict() for p in profiles])


@staff_bp.get("/jobseekers/<profile_id>")
@jwt_required()
@role_required("staff", "admin")
def get_jobseeker(profile_id):
    profile = JobseekerProfile.query.get(profile_id)
    if not profile:
        return fail("Jobseeker not found.", 404)
    result = profile.to_dict(include_email=User.query.get(profile.user_id).email)
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
    return ok(profile.to_dict(), "Jobseeker account updated.")


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
    companies = EmployerCompany.query.order_by(EmployerCompany.created_at.desc()).all()
    return ok([c.to_dict() for c in companies])


@staff_bp.get("/employers/<company_id>")
@jwt_required()
@role_required("staff", "admin")
def get_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    result = company.to_dict(include_email=User.query.get(company.user_id).email)
    result["vacancies"] = [v.to_dict() for v in Vacancy.query.filter_by(employer_company_id=company.id).all()]
    return ok(result)


@staff_bp.put("/employers/<company_id>/verify")
@jwt_required()
@role_required("staff", "admin")
def verify_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    data = request.get_json(force=True) or {}
    if data.get("approve", True):
        company.verification_status = "verified"
    else:
        company.verification_status = "unverified"
        company.verification_remarks = data.get("remarks")
    db.session.commit()
    notify_user(company.user_id, "account_verified", "Company Verification Update",
                f"Your company is now {company.verification_status}.", socket_event="account:verified",
                socket_payload={"employer_id": str(company.id), "status": company.verification_status})
    log_audit(User.query.get(get_jwt_identity()), "Approve", "employers", company.id)
    return ok(company.to_dict(), "Employer verification updated.")


@staff_bp.put("/employers/<company_id>/suspend")
@jwt_required()
@role_required("staff", "admin")
def suspend_employer(company_id):
    company = EmployerCompany.query.get(company_id)
    if not company:
        return fail("Employer not found.", 404)
    company.verification_status = "suspended"
    db.session.commit()
    notify_user(company.user_id, "account_suspended", "Account Suspended", "Your company account has been suspended.",
                socket_event="account:suspended", socket_payload={"employer_id": str(company.id)})
    log_audit(User.query.get(get_jwt_identity()), "Update", "employers", company.id, "Suspended")
    return ok(company.to_dict(), "Employer suspended.")


# ---------- Job Vacancy Management ----------

@staff_bp.get("/vacancies")
@jwt_required()
@role_required("staff", "admin")
def staff_list_vacancies():
    query = Vacancy.query
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    vacancies = query.order_by(Vacancy.created_at.desc()).all()
    return ok([v.to_dict() for v in vacancies])


@staff_bp.get("/vacancies/<vacancy_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_get_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    result = vacancy.to_dict()
    result["applicants"] = [a.to_dict() for a in vacancy.applications]
    return ok(result)


@staff_bp.put("/vacancies/<vacancy_id>/approve")
@jwt_required()
@role_required("staff", "admin")
def approve_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    vacancy.status = "active"
    vacancy.approved_by = get_jwt_identity()
    vacancy.approved_at = datetime.utcnow()
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_approved", "Vacancy Approved",
                f"{vacancy.title} is now live.", socket_event="vacancy:approved",
                socket_payload={"vacancy_id": str(vacancy.id)})
    log_audit(User.query.get(get_jwt_identity()), "Approve", "vacancies", vacancy.id)
    return ok(vacancy.to_dict(), "Vacancy approved.")


@staff_bp.put("/vacancies/<vacancy_id>/reject")
@jwt_required()
@role_required("staff", "admin")
def reject_vacancy(vacancy_id):
    vacancy = Vacancy.query.get(vacancy_id)
    if not vacancy:
        return fail("Vacancy not found.", 404)
    data = request.get_json(force=True) or {}
    vacancy.status = "rejected"
    vacancy.rejection_remarks = data.get("remarks", "")
    db.session.commit()
    notify_user(vacancy.employer_company.user_id, "vacancy_rejected", "Vacancy Returned",
                vacancy.rejection_remarks, socket_event="vacancy:rejected",
                socket_payload={"vacancy_id": str(vacancy.id), "remarks": vacancy.rejection_remarks})
    log_audit(User.query.get(get_jwt_identity()), "Reject", "vacancies", vacancy.id)
    return ok(vacancy.to_dict(), "Vacancy rejected.")


@staff_bp.post("/vacancies")
@jwt_required()
@role_required("staff", "admin")
def staff_create_vacancy():
    """Manual add for walk-in employer without a system account."""
    data = request.get_json(force=True) or {}
    company_id = data.get("employer_company_id")
    if not company_id:
        return fail("employer_company_id is required.", 400)
    vacancy = Vacancy(
        employer_company_id=company_id, title=data.get("title", ""), description=data.get("description", ""),
        requirements=data.get("requirements"), skills_required=data.get("skills_required"),
        job_type=data.get("job_type"), num_slots=data.get("num_slots", 1), work_location=data.get("work_location"),
        status="active", is_manual_entry=True, approved_by=get_jwt_identity(), approved_at=datetime.utcnow(),
    )
    db.session.add(vacancy)
    db.session.commit()
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
    return ok(record.to_dict(), "Employment record created.", 201)


@staff_bp.get("/employment/report")
@jwt_required()
@role_required("staff", "admin")
def employment_report():
    records = EmploymentRecord.query.all()
    rows = [[r.jobseeker_profile.full_name, r.employer_company.company_name, r.position, r.status, str(r.start_date)] for r in records]
    fmt = request.args.get("format", "excel")
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
