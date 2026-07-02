from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.employer import EmployerCompany
from models.jobfair import JobFair, JobFairBooth, JobFairRegistration
from models.jobseeker import JobseekerProfile
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_email
from services.excel_service import build_excel_report
from services.notification_service import notify_role, notify_user
from services.pdf_service import generate_table_report, to_bytesio
from services.qr_service import generate_qr_data_url
from sockets.events import emit_to_role
from utils.decorators import role_required
from utils.responses import fail, ok

jobfair_bp = Blueprint("jobfair", __name__, url_prefix="/api")
staff_jobfair_bp = Blueprint("staff_jobfair", __name__, url_prefix="/api/staff/jobfair")


# ---------- Shared read ----------

@jobfair_bp.get("/jobfair")
@jwt_required()
def list_jobfairs():
    fairs = JobFair.query.order_by(JobFair.event_date.desc()).all()
    return ok([f.to_dict() for f in fairs])


@jobfair_bp.get("/jobfair/<jobfair_id>")
@jwt_required()
def get_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    result = fair.to_dict()
    result["booths"] = [b.to_dict() for b in fair.booths]
    return ok(result)


# ---------- Jobseeker ----------

@jobfair_bp.post("/jobfair/<jobfair_id>/register")
@jwt_required()
@role_required("jobseeker")
def register_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)
    if JobFairRegistration.query.filter_by(jobfair_id=fair.id, jobseeker_profile_id=profile.id).first():
        return fail("Already registered for this job fair.", 409)

    registration = JobFairRegistration(jobfair_id=fair.id, jobseeker_profile_id=profile.id)
    db.session.add(registration)
    db.session.commit()

    user = User.query.get(profile.user_id)
    qr_data_url = generate_qr_data_url(registration.qr_token)
    send_email(user.email, f"Job Fair Registration — {fair.name}",
               f"<p>You're registered for <b>{fair.name}</b> on {fair.event_date}. Show your QR code at the venue.</p>")

    return ok({**registration.to_dict(), "qr_data_url": qr_data_url}, "Registered. QR code emailed to you.", 201)


# ---------- Employer ----------

@jobfair_bp.post("/jobfair/<jobfair_id>/register-booth")
@jwt_required()
@role_required("employer")
def register_booth(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not fair or not company:
        return fail("Not found.", 404)
    if JobFairBooth.query.filter_by(jobfair_id=fair.id, employer_company_id=company.id).first():
        return fail("Booth already registered.", 409)
    booth = JobFairBooth(jobfair_id=fair.id, employer_company_id=company.id)
    db.session.add(booth)
    db.session.commit()
    return ok(booth.to_dict(), "Booth registered.", 201)


# ---------- Staff ----------

@staff_jobfair_bp.post("")
@jwt_required()
@role_required("staff", "admin")
def create_jobfair():
    data = request.get_json(force=True) or {}
    fair = JobFair(
        name=data.get("name", ""),
        description=data.get("description"),
        venue=data.get("venue", ""),
        event_date=datetime.fromisoformat(data["event_date"]),
        max_employer_slots=data.get("max_employer_slots", 20),
        max_jobseeker_slots=data.get("max_jobseeker_slots", 200),
        created_by=get_jwt_identity(),
    )
    db.session.add(fair)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "jobfair", fair.id)
    notify_role("jobseeker", "jobfair:new", fair.to_dict())
    notify_role("employer", "jobfair:new", fair.to_dict())
    return ok(fair.to_dict(), "Job fair created.", 201)


@staff_jobfair_bp.put("/<jobfair_id>")
@jwt_required()
@role_required("staff", "admin")
def update_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("name", "description", "venue", "max_employer_slots", "max_jobseeker_slots", "status"):
        if field in data:
            setattr(fair, field, data[field])
    if data.get("event_date"):
        fair.event_date = datetime.fromisoformat(data["event_date"])
    db.session.commit()
    return ok(fair.to_dict(), "Job fair updated.")


@staff_jobfair_bp.post("/<jobfair_id>/scan-qr")
@jwt_required()
@role_required("staff", "admin")
def scan_qr(jobfair_id):
    data = request.get_json(force=True) or {}
    token = data.get("qr_token")
    registration = JobFairRegistration.query.filter_by(jobfair_id=jobfair_id, qr_token=token).first()
    if not registration:
        return fail("Invalid QR code for this job fair.", 404)
    if registration.attended:
        return fail("This QR code has already been scanned.", 409)

    registration.attended = True
    registration.scanned_at = datetime.utcnow()
    db.session.commit()

    emit_to_role("staff", "jobfair:qr_scanned", {
        "jobfair_id": str(jobfair_id),
        "jobseeker_id": str(registration.jobseeker_profile_id),
        "jobseeker_name": registration.jobseeker_profile.full_name,
        "scan_time": registration.scanned_at.isoformat(),
    })
    return ok(registration.to_dict(), "Attendance marked.")


@staff_jobfair_bp.get("/<jobfair_id>/attendance-report")
@jwt_required()
@role_required("staff", "admin")
def attendance_report(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    fmt = request.args.get("format", "excel")
    rows = [[r.jobseeker_profile.full_name, "Yes" if r.attended else "No", r.scanned_at or ""] for r in fair.registrations]

    if fmt == "pdf":
        pdf_bytes = generate_table_report(f"Attendance — {fair.name}", ["Jobseeker", "Attended", "Scanned At"], rows, datetime.utcnow().strftime("%Y-%m-%d"))
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="attendance.pdf")

    buf = build_excel_report(f"Attendance {fair.name}", ["Jobseeker", "Attended", "Scanned At"], rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="attendance.xlsx")
