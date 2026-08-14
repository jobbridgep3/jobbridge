"""SPES (Special Program for Employment of Students) module — batch creation,
registration + eligibility validation, application review, independent
orientation/exam scheduling + QR attendance, orientation-outcome/exam-result
encoding, deployment, and DTR. Standalone from blueprints/programs.py (the shared
SPES/DILP generic system) — see models/spes.py's module docstring for why.

Admin is restricted to batch management + reports (system-wide); every day-to-day
operational action (application review, scheduling, QR scanning, outcome/result
encoding, deployment, DTR review) is Staff-only, enforced via role_required("staff")
rather than the role_required("staff", "admin") every other program-style module in
this codebase uses — this is the first module where Admin and Staff routes genuinely
diverge instead of sharing identical permissions.
"""

from datetime import date, datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import selectinload

from extensions import db
from models.jobseeker import JobseekerProfile
from models.spes import (
    SPES_ATTENDANCE_EVENT_TYPES,
    SpesApplication,
    SpesAttendanceLog,
    SpesBatch,
    SpesDeployment,
    SpesDtrEntry,
)
from models.user import User
from services import spes_reporting_service, spes_service
from services.audit_service import log_audit
from services.email_service import (
    send_spes_deployment_email,
    send_spes_exam_notice_email,
    send_spes_orientation_notice_email,
    send_spes_registration_confirmation_email,
    send_spes_result_failed_email,
    send_spes_result_passed_email,
)
from services.excel_service import build_multi_sheet_excel_report
from services.notification_service import notify_board, notify_user
from services.pdf_service import SPES_STAT_LABELS, generate_spes_application_form, generate_spes_report, to_bytesio
from services.qr_service import generate_qr_data_url
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import MANILA_TZ, now_manila

spes_bp = Blueprint("spes", __name__, url_prefix="/api")

_APP_EAGER = (selectinload(SpesApplication.jobseeker_profile).selectinload(JobseekerProfile.user), selectinload(SpesApplication.batch))


def _notify_jobseeker(application: SpesApplication, title: str, message: str):
    notify_user(
        application.jobseeker_profile.user_id, "spes_status", title, message,
        link="/jobseeker/spes",
        socket_event="spes:status_change",
        socket_payload={"application_id": str(application.id), "new_status": application.status},
    )


def _notify_board(application: SpesApplication, title: str, message: str):
    payload = {"application_id": str(application.id)}
    notify_board(
        [("staff", f"/staff/spes/applicants/{application.id}"), ("admin", "/admin/spes")],
        "spes_board", title, message,
        socket_event="spes:board_update", socket_payload=payload,
    )


# ==================== Jobseeker ====================

@spes_bp.get("/spes/batches")
@jwt_required()
@role_required("jobseeker")
def list_spes_batches():
    batches = SpesBatch.query.filter_by(status="open").order_by(SpesBatch.registration_deadline.asc()).all()
    return ok([b.to_dict() for b in batches])


@spes_bp.get("/spes/batches/<batch_id>")
@jwt_required()
@role_required("jobseeker")
def get_spes_batch(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    return ok(batch.to_dict())


@spes_bp.post("/spes/batches/<batch_id>/register")
@jwt_required()
@role_required("jobseeker")
def register_spes_batch(batch_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)
    age = profile.age()
    if age is None:
        return fail("Add your date of birth to your profile before registering for SPES.", 400)

    data = request.get_json(force=True) or {}
    school_name = (data.get("school_name") or "").strip()
    year_level = (data.get("year_level") or "").strip()
    if not school_name or not year_level:
        return fail("School name and year level are required.", 400)
    try:
        family_income = float(data.get("family_income"))
        gwa = float(data.get("gwa"))
    except (TypeError, ValueError):
        return fail("Family income and GWA must be valid numbers.", 400)
    if family_income < 0 or gwa < 0:
        return fail("Family income and GWA cannot be negative.", 400)

    batch, capacity_ok, error = spes_service.lock_batch_and_check_capacity(batch_id)
    if not capacity_ok:
        return fail(error, 404 if not batch else 400)

    eligible, error = spes_service.validate_registration_eligibility(profile, batch, age, gwa, family_income)
    if not eligible:
        db.session.rollback()
        return fail(error, 400)

    application = SpesApplication(
        batch_id=batch.id, jobseeker_profile_id=profile.id,
        application_ref_no=spes_service.generate_application_ref_no(),
        status="pending_review",
        full_name=profile.full_name, date_of_birth=profile.date_of_birth, age=age,
        school_name=school_name, year_level=year_level,
        family_income=family_income, gwa=gwa,
        submitted_at=now_manila(),
    )
    db.session.add(application)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "spes_application", application.id)

    application_dict = application.to_dict()
    profile_dict = profile.to_dict()
    batch_dict = batch.to_dict()
    profile_email = profile.user.email
    profile_full_name = profile.full_name
    qr_token = application.qr_token
    application_id = application.id

    # Release the DB connection before the slow, blocking PDF render + Storage upload
    # call — see the identical comment in blueprints/owwa.py's apply_owwa_request.
    db.session.close()

    qr_data_url = generate_qr_data_url(qr_token)
    from services.storage_service import upload_file

    pdf_bytes = generate_spes_application_form(application_dict, profile_dict, batch_dict, qr_data_url, now_manila().strftime("%B %d, %Y"))
    filename = f"SPES_Application_Form_{application_id}.pdf"
    file_url = upload_file(pdf_bytes, filename, folder=f"spes-docs/{application_id}/application_form", content_type="application/pdf")

    application = SpesApplication.query.get(application_id)
    application.application_form_pdf_url = file_url
    db.session.commit()

    send_spes_registration_confirmation_email(profile_email, profile_full_name, batch_dict["batch_name"], application.application_ref_no, batch_dict["requirements"])
    _notify_jobseeker(application, "SPES application received", "Your application is under review by PESO staff.")
    _notify_board(application, "New SPES application", f"{profile_full_name} submitted a new SPES application for {batch_dict['batch_name']}.")

    return ok(application.to_dict(), f"Registered! Your application reference is {application.application_ref_no}.", 201)


@spes_bp.get("/spes/my")
@jwt_required()
@role_required("jobseeker")
def my_spes_applications():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    applications = SpesApplication.query.options(*_APP_EAGER).filter_by(jobseeker_profile_id=profile.id).order_by(SpesApplication.created_at.desc()).all()
    return ok([a.to_dict(include_attendance=True, include_deployment=True) for a in applications])


def _own_application_or_error(application_id, user_id):
    profile = JobseekerProfile.query.filter_by(user_id=user_id).first()
    application = SpesApplication.query.get(application_id)
    if not application or not profile or application.jobseeker_profile_id != profile.id:
        return None, fail("Application not found.", 404)
    return application, None


@spes_bp.get("/spes/<application_id>/form-pdf")
@jwt_required()
@role_required("jobseeker")
def download_spes_application_form(application_id):
    application, error = _own_application_or_error(application_id, get_jwt_identity())
    if error:
        return error

    qr_data_url = generate_qr_data_url(application.qr_token)
    pdf_bytes = generate_spes_application_form(
        application.to_dict(), application.jobseeker_profile.to_dict(), application.batch.to_dict(),
        qr_data_url, now_manila().strftime("%B %d, %Y"),
    )
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="spes-application-form.pdf")


@spes_bp.post("/spes/<application_id>/documents")
@jwt_required()
@role_required("jobseeker")
def upload_spes_document(application_id):
    from services.storage_service import upload_file, validate_upload_file

    application, error = _own_application_or_error(application_id, get_jwt_identity())
    if error:
        return error
    if application.status != "pending_review":
        return fail("Documents can only be added while your application is pending review.", 400)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    validation_error = validate_upload_file(file_bytes, file.filename)
    if validation_error:
        return fail(validation_error, 400)

    db.session.close()
    file_url = upload_file(file_bytes, file.filename, folder=f"spes-docs/{application_id}/supporting", content_type=file.mimetype)

    application = SpesApplication.query.get(application_id)
    docs = list(application.document_urls or [])
    docs.append({"url": file_url, "filename": file.filename})
    application.document_urls = docs
    db.session.commit()
    return ok(application.to_dict(), "Document uploaded.")


def _active_deployment_for_user(user_id):
    profile = JobseekerProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        return None
    return (
        SpesDeployment.query.join(SpesApplication)
        .filter(SpesApplication.jobseeker_profile_id == profile.id, SpesApplication.status == "deployed")
        .order_by(SpesDeployment.created_at.desc()).first()
    )


@spes_bp.get("/spes/my/dtr")
@jwt_required()
@role_required("jobseeker")
def my_spes_dtr():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    entries = (
        SpesDtrEntry.query.join(SpesDeployment).join(SpesApplication)
        .filter(SpesApplication.jobseeker_profile_id == profile.id)
        .order_by(SpesDtrEntry.work_date.desc()).all()
    )
    return ok([e.to_dict() for e in entries])


@spes_bp.post("/spes/my/dtr")
@jwt_required()
@role_required("jobseeker")
def submit_spes_dtr():
    deployment = _active_deployment_for_user(get_jwt_identity())
    if not deployment:
        return fail("You must be an active SPES deployment to submit a DTR entry.", 400)

    data = request.get_json(force=True) or {}
    try:
        work_date = date.fromisoformat(data.get("work_date"))
        time_in = datetime.strptime(data.get("time_in"), "%H:%M").time()
        time_out = datetime.strptime(data.get("time_out"), "%H:%M").time()
    except (TypeError, ValueError):
        return fail("Provide a valid date and time in/time out.", 400)

    if work_date > now_manila().date():
        return fail("DTR entries cannot be submitted for a future date.", 400)
    if SpesDtrEntry.query.filter_by(deployment_id=deployment.id, work_date=work_date).first():
        return fail("You have already submitted a DTR entry for this date.", 400)

    entry = SpesDtrEntry(deployment_id=deployment.id, work_date=work_date, time_in=time_in, time_out=time_out, status="pending")
    db.session.add(entry)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "spes_dtr_entry", entry.id)
    return ok(entry.to_dict(), "DTR entry submitted.", 201)


# ==================== Staff ====================

@spes_bp.get("/staff/spes/dashboard")
@jwt_required()
@role_required("staff", "admin")
def staff_spes_dashboard():
    batch_id = request.args.get("batch_id") or None
    return ok(spes_reporting_service.build_spes_stats(batch_id))


@spes_bp.get("/staff/spes/batches")
@jwt_required()
@role_required("staff", "admin")
def staff_list_spes_batches():
    batches = SpesBatch.query.order_by(SpesBatch.created_at.desc()).all()
    return ok([b.to_dict() for b in batches])


def _query_spes_applications(args):
    query = SpesApplication.query.options(*_APP_EAGER)
    if args.get("batch_id"):
        query = query.filter(SpesApplication.batch_id == args["batch_id"])
    if args.get("status"):
        query = query.filter(SpesApplication.status == args["status"])
    if args.get("search"):
        query = query.filter(SpesApplication.full_name.ilike(f"%{args['search']}%"))
    return query.order_by(SpesApplication.submitted_at.desc()).all()


@spes_bp.get("/staff/spes/applications")
@jwt_required()
@role_required("staff", "admin")
def staff_list_spes_applications():
    applications = _query_spes_applications(request.args)
    return ok([a.to_dict() for a in applications])


@spes_bp.get("/staff/spes/applications/<application_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_spes_application_detail(application_id):
    application = SpesApplication.query.options(*_APP_EAGER, selectinload(SpesApplication.attendance_logs), selectinload(SpesApplication.deployment)).get(application_id)
    if not application:
        return fail("Application not found.", 404)
    return ok(application.to_dict(include_attendance=True, include_deployment=True))


@spes_bp.put("/staff/spes/applications/<application_id>/approve")
@jwt_required()
@role_required("staff")
def staff_approve_spes_application(application_id):
    application = SpesApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    if application.status != "pending_review":
        return fail("Only applications pending review can be approved.", 400)

    application.status = "approved_for_orientation"
    application.reviewed_by = get_jwt_identity()
    application.reviewed_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Approve", "spes_application", application.id)

    _notify_jobseeker(application, "SPES application approved", "You've been approved for orientation. Watch for the schedule email.")
    _notify_board(application, "SPES application approved", f"{application.full_name}'s SPES application was approved for orientation.")
    return ok(application.to_dict(), "Application approved for orientation.")


@spes_bp.put("/staff/spes/applications/<application_id>/reject")
@jwt_required()
@role_required("staff")
def staff_reject_spes_application(application_id):
    application = SpesApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    if application.status != "pending_review":
        return fail("Only applications pending review can be rejected.", 400)
    data = request.get_json(force=True) or {}
    reason = (data.get("remarks") or "").strip()
    if not reason:
        return fail("A reason is required to reject this application.", 400)

    application.status = "rejected"
    application.review_remarks = reason
    application.reviewed_by = get_jwt_identity()
    application.reviewed_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Reject", "spes_application", application.id, details=reason)

    _notify_jobseeker(application, "SPES application rejected", reason)
    _notify_board(application, "SPES application rejected", f"{application.full_name}'s SPES application was rejected. Reason: {reason}")
    return ok(application.to_dict(), "Application rejected.")


def _parse_schedule_body(data):
    """Returns (parsed_dict, error_response). parsed_dict has keys
    scheduled_at/venue/dress_code on success; error_response is a Flask response
    (from utils.responses.fail) on failure — the standard two-tuple shape used
    throughout this blueprint."""
    date_str = (data.get("date") or "").strip()
    time_str = (data.get("time") or "").strip()
    venue = (data.get("venue") or "").strip()
    dress_code = data.get("dress_code") or {}
    if not date_str or not time_str or not venue:
        return None, fail("Date, time, and venue are required.", 400)
    try:
        scheduled_at = MANILA_TZ.localize(datetime.fromisoformat(f"{date_str}T{time_str}"))
    except ValueError:
        return None, fail("Invalid date/time.", 400)
    return {
        "scheduled_at": scheduled_at, "venue": venue,
        "dress_code": {"top": dress_code.get("top") or [], "bottom": dress_code.get("bottom") or [], "footwear": dress_code.get("footwear") or []},
    }, None


@spes_bp.get("/staff/spes/batches/<batch_id>/orientation-schedule/recipient-count")
@jwt_required()
@role_required("staff", "admin")
def spes_orientation_recipient_count(batch_id):
    count = SpesApplication.query.filter_by(batch_id=batch_id, status="approved_for_orientation").count()
    return ok({"count": count})


@spes_bp.put("/staff/spes/batches/<batch_id>/orientation-schedule")
@jwt_required()
@role_required("staff")
def staff_set_spes_orientation_schedule(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    data = request.get_json(force=True) or {}
    parsed, error = _parse_schedule_body(data)
    if error:
        return error
    scheduled_at, venue, dress_code = parsed["scheduled_at"], parsed["venue"], parsed["dress_code"]

    batch.orientation_at = scheduled_at
    batch.orientation_venue = venue
    batch.orientation_dress_code = dress_code
    batch.orientation_notice_sent_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_batch", batch.id, details="Set orientation schedule")

    date_str = scheduled_at.strftime("%B %d, %Y")
    time_str = scheduled_at.strftime("%I:%M %p")
    applications = SpesApplication.query.options(*_APP_EAGER).filter_by(batch_id=batch.id, status="approved_for_orientation").all()
    for application in applications:
        send_spes_orientation_notice_email(
            application.jobseeker_profile.user.email, application.full_name, batch.batch_name, date_str, time_str, venue, dress_code,
        )
        _notify_jobseeker(application, "SPES orientation scheduled", f"Orientation for {batch.batch_name} is scheduled on {date_str} at {time_str}.")
    return ok(batch.to_dict(), f"Orientation schedule saved — {len(applications)} applicant(s) notified.")


@spes_bp.get("/staff/spes/batches/<batch_id>/exam-schedule/recipient-count")
@jwt_required()
@role_required("staff", "admin")
def spes_exam_recipient_count(batch_id):
    count = SpesApplication.query.filter_by(batch_id=batch_id, status="attended_orientation").count()
    return ok({"count": count})


@spes_bp.put("/staff/spes/batches/<batch_id>/exam-schedule")
@jwt_required()
@role_required("staff")
def staff_set_spes_exam_schedule(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    data = request.get_json(force=True) or {}
    parsed, error = _parse_schedule_body(data)
    if error:
        return error
    scheduled_at, venue, dress_code = parsed["scheduled_at"], parsed["venue"], parsed["dress_code"]

    batch.exam_at = scheduled_at
    batch.exam_venue = venue
    batch.exam_dress_code = dress_code
    batch.exam_notice_sent_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_batch", batch.id, details="Set exam schedule")

    date_str = scheduled_at.strftime("%B %d, %Y")
    time_str = scheduled_at.strftime("%I:%M %p")
    applications = SpesApplication.query.options(*_APP_EAGER).filter_by(batch_id=batch.id, status="attended_orientation").all()
    for application in applications:
        send_spes_exam_notice_email(
            application.jobseeker_profile.user.email, application.full_name, batch.batch_name, date_str, time_str, venue, dress_code,
        )
        _notify_jobseeker(application, "SPES exam scheduled", f"Your SPES exam for {batch.batch_name} is scheduled on {date_str} at {time_str}.")
    return ok(batch.to_dict(), f"Exam schedule saved — {len(applications)} applicant(s) notified.")


@spes_bp.post("/staff/spes/scan-qr")
@jwt_required()
@role_required("staff")
def staff_scan_spes_qr():
    data = request.get_json(force=True) or {}
    token = data.get("qr_token")
    event_type = data.get("event_type")
    if event_type not in SPES_ATTENDANCE_EVENT_TYPES:
        return fail("Select an event type (Orientation or Exam) before scanning.", 400)

    application = SpesApplication.query.options(*_APP_EAGER).filter_by(qr_token=token).first()
    if not application:
        return fail("Invalid SPES QR code.", 404)
    if SpesAttendanceLog.query.filter_by(application_id=application.id, event_type=event_type).first():
        return fail(f"{application.full_name} is already marked present for this {event_type} session.", 409)

    log = SpesAttendanceLog(application_id=application.id, event_type=event_type, scanned_at=now_manila(), scanned_by=get_jwt_identity())
    db.session.add(log)
    db.session.commit()

    notify_board(
        [("staff", "/staff/spes/scanner")], "spes_attendance", "SPES attendance scanned",
        f"{application.full_name} marked present ({event_type}).",
        socket_event="spes:attendance_scanned",
        socket_payload={"application_id": str(application.id), "batch_id": str(application.batch_id), "event_type": event_type},
    )
    return ok({"application": application.to_dict(), "log": log.to_dict()}, f"{application.full_name} marked present.")


@spes_bp.get("/staff/spes/batches/<batch_id>/attendance")
@jwt_required()
@role_required("staff", "admin")
def spes_attendance_dashboard(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    event_type = request.args.get("event_type")
    if event_type not in SPES_ATTENDANCE_EVENT_TYPES:
        return fail("Select an event type (Orientation or Exam).", 400)

    logs = (
        SpesAttendanceLog.query.join(SpesApplication)
        .filter(SpesApplication.batch_id == batch_id, SpesAttendanceLog.event_type == event_type)
        .order_by(SpesAttendanceLog.scanned_at.desc()).all()
    )
    eligible_statuses = (
        spes_reporting_service.ORIENTATION_INVITED_STATUSES if event_type == "orientation"
        else spes_reporting_service.EXAM_ELIGIBLE_STATUSES
    )
    total_eligible = SpesApplication.query.filter(
        SpesApplication.batch_id == batch_id, SpesApplication.status.in_(eligible_statuses),
    ).count()
    return ok({
        "batch": batch.to_dict(),
        "total_eligible": total_eligible,
        "total_scanned": len(logs),
        "logs": [{**log.to_dict(), "jobseeker_name": log.application.full_name} for log in logs],
    })


def _set_orientation_outcome(application, outcome, remarks):
    if application.status != "approved_for_orientation":
        return fail(f"{application.full_name}: only applicants approved for orientation can have an outcome recorded.", 400)
    application.status = "attended_orientation" if outcome == "attended" else "failed_orientation"
    application.orientation_outcome_remarks = remarks
    application.orientation_outcome_by = get_jwt_identity()
    application.orientation_outcome_at = now_manila()
    return None


@spes_bp.put("/staff/spes/applications/<application_id>/orientation-outcome")
@jwt_required()
@role_required("staff")
def staff_set_orientation_outcome(application_id):
    application = SpesApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    outcome = data.get("outcome")
    if outcome not in ("attended", "failed"):
        return fail("Outcome must be 'attended' or 'failed'.", 400)

    error = _set_orientation_outcome(application, outcome, data.get("remarks"))
    if error:
        return error
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details=f"Orientation outcome: {outcome}")
    _notify_jobseeker(application, "SPES orientation outcome recorded", f"Your orientation outcome has been recorded: {application.status.replace('_', ' ').title()}.")
    return ok(application.to_dict(), "Orientation outcome saved.")


@spes_bp.post("/staff/spes/orientation-outcomes/bulk")
@jwt_required()
@role_required("staff")
def staff_bulk_orientation_outcomes():
    data = request.get_json(force=True) or {}
    items = data.get("items") or []
    saved, errors = [], []
    for item in items:
        application = SpesApplication.query.get(item.get("application_id"))
        if not application:
            errors.append({"application_id": item.get("application_id"), "error": "Application not found."})
            continue
        outcome = item.get("outcome")
        if outcome not in ("attended", "failed"):
            errors.append({"application_id": item.get("application_id"), "error": "Invalid outcome."})
            continue
        error = _set_orientation_outcome(application, outcome, item.get("remarks"))
        if error:
            errors.append({"application_id": item.get("application_id"), "error": "Not eligible for orientation outcome."})
            continue
        saved.append(application)
    db.session.commit()
    for application in saved:
        log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details="Orientation outcome (bulk)")
        _notify_jobseeker(application, "SPES orientation outcome recorded", f"Your orientation outcome has been recorded: {application.status.replace('_', ' ').title()}.")
    return ok({"saved": len(saved), "errors": errors}, f"{len(saved)} outcome(s) saved.")


def _set_exam_result(application, result, remarks):
    if application.status != "attended_orientation":
        return None, fail(f"{application.full_name}: only applicants who attended orientation can have an exam result recorded.", 400)
    application.status = "for_deployment" if result == "passed" else "failed"
    application.exam_result_remarks = remarks
    application.exam_result_by = get_jwt_identity()
    application.exam_result_at = now_manila()
    return application, None


@spes_bp.put("/staff/spes/applications/<application_id>/exam-result")
@jwt_required()
@role_required("staff")
def staff_set_exam_result(application_id):
    application = SpesApplication.query.options(*_APP_EAGER).get(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    result = data.get("result")
    if result not in ("passed", "failed"):
        return fail("Result must be 'passed' or 'failed'.", 400)

    _, error = _set_exam_result(application, result, data.get("remarks"))
    if error:
        return error
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details=f"Exam result: {result}")

    if result == "passed":
        send_spes_result_passed_email(application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name)
    else:
        send_spes_result_failed_email(application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name)
    _notify_jobseeker(application, "SPES exam result available", f"Your SPES exam result is available: {application.status.replace('_', ' ').title()}.")
    return ok(application.to_dict(), "Exam result saved.")


@spes_bp.post("/staff/spes/exam-results/bulk")
@jwt_required()
@role_required("staff")
def staff_bulk_exam_results():
    data = request.get_json(force=True) or {}
    items = data.get("items") or []
    saved, errors = [], []
    for item in items:
        application = SpesApplication.query.options(*_APP_EAGER).get(item.get("application_id"))
        if not application:
            errors.append({"application_id": item.get("application_id"), "error": "Application not found."})
            continue
        result = item.get("result")
        if result not in ("passed", "failed"):
            errors.append({"application_id": item.get("application_id"), "error": "Invalid result."})
            continue
        _, error = _set_exam_result(application, result, item.get("remarks"))
        if error:
            errors.append({"application_id": item.get("application_id"), "error": "Not eligible for an exam result."})
            continue
        saved.append((application, result))
    db.session.commit()
    for application, result in saved:
        log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details=f"Exam result (bulk): {result}")
        if result == "passed":
            send_spes_result_passed_email(application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name)
        else:
            send_spes_result_failed_email(application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name)
        _notify_jobseeker(application, "SPES exam result available", f"Your SPES exam result is available: {application.status.replace('_', ' ').title()}.")
    return ok({"saved": len(saved), "errors": errors}, f"{len(saved)} result(s) saved.")


@spes_bp.post("/staff/spes/applications/<application_id>/deployment")
@jwt_required()
@role_required("staff")
def staff_assign_spes_deployment(application_id):
    application = SpesApplication.query.options(*_APP_EAGER).get(application_id)
    if not application:
        return fail("Application not found.", 404)
    if application.status != "for_deployment":
        return fail("Only applicants awaiting deployment can be assigned.", 400)

    data = request.get_json(force=True) or {}
    employer_company_id = data.get("employer_company_id") or None
    office_name = (data.get("office_name") or "").strip() or None
    supervisor_name = (data.get("supervisor_name") or "").strip()
    start_date_str = data.get("start_date")
    if not employer_company_id and not office_name:
        return fail("Select an employer or enter an office name.", 400)
    if not supervisor_name:
        return fail("Supervisor name is required.", 400)
    try:
        start_date = date.fromisoformat(start_date_str)
    except (TypeError, ValueError):
        return fail("A valid reporting start date is required.", 400)

    deployment = SpesDeployment(
        application_id=application.id, employer_company_id=employer_company_id, office_name=office_name,
        supervisor_name=supervisor_name, start_date=start_date, created_by=get_jwt_identity(),
    )
    application.status = "deployed"
    db.session.add(deployment)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "spes_deployment", deployment.id)

    office_or_employer_name = deployment.employer_company.company_name if deployment.employer_company else office_name
    send_spes_deployment_email(
        application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name,
        office_or_employer_name, supervisor_name, start_date.strftime("%B %d, %Y"),
    )
    _notify_jobseeker(application, "SPES deployment assigned", f"You've been deployed to {office_or_employer_name}, reporting {start_date.strftime('%B %d, %Y')}.")
    return ok(application.to_dict(include_deployment=True), "Deployment assigned.")


@spes_bp.put("/staff/spes/deployments/<deployment_id>/complete")
@jwt_required()
@role_required("staff")
def staff_complete_spes_deployment(deployment_id):
    deployment = SpesDeployment.query.get(deployment_id)
    if not deployment or not deployment.application:
        return fail("Deployment not found.", 404)
    if deployment.application.status != "deployed":
        return fail("Only active deployments can be marked completed.", 400)

    deployment.completed_at = now_manila()
    deployment.application.status = "completed"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_deployment", deployment.id, details="Completed")
    _notify_jobseeker(deployment.application, "SPES deployment completed", "Your SPES engagement has been marked completed. Thank you for your participation!")
    return ok(deployment.application.to_dict(include_deployment=True), "Deployment marked completed.")


@spes_bp.put("/staff/spes/deployments/<deployment_id>/terminate")
@jwt_required()
@role_required("staff")
def staff_terminate_spes_deployment(deployment_id):
    deployment = SpesDeployment.query.get(deployment_id)
    if not deployment or not deployment.application:
        return fail("Deployment not found.", 404)
    if deployment.application.status != "deployed":
        return fail("Only active deployments can be terminated.", 400)
    data = request.get_json(force=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return fail("A reason is required to terminate this deployment.", 400)

    deployment.terminated_at = now_manila()
    deployment.termination_reason = reason
    deployment.application.status = "terminated"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_deployment", deployment.id, details=reason)
    _notify_jobseeker(deployment.application, "SPES deployment terminated", reason)
    return ok(deployment.application.to_dict(include_deployment=True), "Deployment marked terminated.")


@spes_bp.get("/staff/spes/dtr")
@jwt_required()
@role_required("staff", "admin")
def staff_list_spes_dtr():
    query = SpesDtrEntry.query.join(SpesDeployment).join(SpesApplication)
    if request.args.get("status"):
        query = query.filter(SpesDtrEntry.status == request.args["status"])
    if request.args.get("search"):
        query = query.filter(SpesApplication.full_name.ilike(f"%{request.args['search']}%"))
    if request.args.get("date_from"):
        query = query.filter(SpesDtrEntry.work_date >= request.args["date_from"])
    if request.args.get("date_to"):
        query = query.filter(SpesDtrEntry.work_date <= request.args["date_to"])
    entries = query.order_by(SpesDtrEntry.work_date.desc()).all()
    return ok([e.to_dict() for e in entries])


@spes_bp.put("/staff/spes/dtr/<entry_id>/approve")
@jwt_required()
@role_required("staff")
def staff_approve_spes_dtr(entry_id):
    entry = SpesDtrEntry.query.get(entry_id)
    if not entry:
        return fail("DTR entry not found.", 404)
    if entry.status != "pending":
        return fail("Only pending DTR entries can be approved.", 400)
    data = request.get_json(silent=True) or {}
    entry.status = "approved"
    entry.staff_remarks = data.get("remarks")
    entry.reviewed_by = get_jwt_identity()
    entry.reviewed_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Approve", "spes_dtr_entry", entry.id)
    return ok(entry.to_dict(), "DTR entry approved.")


@spes_bp.put("/staff/spes/dtr/<entry_id>/reject")
@jwt_required()
@role_required("staff")
def staff_reject_spes_dtr(entry_id):
    entry = SpesDtrEntry.query.get(entry_id)
    if not entry:
        return fail("DTR entry not found.", 404)
    if entry.status != "pending":
        return fail("Only pending DTR entries can be rejected.", 400)
    data = request.get_json(silent=True) or {}
    entry.status = "rejected"
    entry.staff_remarks = data.get("remarks")
    entry.reviewed_by = get_jwt_identity()
    entry.reviewed_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Reject", "spes_dtr_entry", entry.id)
    return ok(entry.to_dict(), "DTR entry rejected.")


# ---------- Reporting (staff + admin, read-only) ----------

def _parse_spes_report_filters(args):
    return {
        "batch_id": args.get("batch_id") or None,
        "status": args.get("status") or None,
        "date_from": date.fromisoformat(args["date_from"]) if args.get("date_from") else None,
        "date_to": date.fromisoformat(args["date_to"]) if args.get("date_to") else None,
        "search": args.get("search") or None,
    }


@spes_bp.get("/staff/spes/reports/stats")
@jwt_required()
@role_required("staff", "admin")
def staff_spes_report_stats():
    batch_id = request.args.get("batch_id") or None
    return ok(spes_reporting_service.build_spes_stats(batch_id))


@spes_bp.get("/staff/spes/reports/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_spes_excel():
    filters = _parse_spes_report_filters(request.args)
    applications = spes_reporting_service.query_spes_applications_for_report(**filters)
    stats = spes_reporting_service.build_spes_stats(filters["batch_id"])
    user = User.query.get(get_jwt_identity())
    date_str = now_manila().strftime("%B %d, %Y %I:%M %p")

    summary_rows = [
        ["Generated:", date_str],
        ["Generated By:", f"{user.email} ({user.role})"],
        ["", ""],
        ["Metric", "Value"],
        *[[SPES_STAT_LABELS.get(k, k), v] for k, v in stats.items()],
    ]
    application_rows = [
        [d["application_ref_no"], d["jobseeker_name"], d["batch_name"], d["status"], d["gwa"], d["family_income"], d["submitted_at"], d["reviewed_at"], d["orientation_outcome_at"], d["exam_result_at"]]
        for d in (spes_reporting_service.spes_report_row(a) for a in applications)
    ]

    buf = build_multi_sheet_excel_report([
        ("Summary", ["PESO Pila, Laguna — SPES Program Report", ""], summary_rows),
        (
            "Applications",
            ["Reference #", "Applicant", "Batch", "Status", "GWA", "Family Income", "Submitted", "Reviewed", "Orientation Outcome", "Exam Result"],
            application_rows,
        ),
    ])
    log_audit(user, "Export", "spes_report", details="excel")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="spes_report.xlsx")


@spes_bp.get("/staff/spes/reports/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_spes_pdf():
    filters = _parse_spes_report_filters(request.args)
    applications = spes_reporting_service.query_spes_applications_for_report(**filters)
    stats = spes_reporting_service.build_spes_stats(filters["batch_id"])
    user = User.query.get(get_jwt_identity())
    date_str = now_manila().strftime("%B %d, %Y %I:%M %p")

    rows = [spes_reporting_service.spes_report_row(a) for a in applications]
    pdf_bytes = generate_spes_report(stats, rows, date_str, user.email, user.role)
    log_audit(user, "Export", "spes_report", details="pdf")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="spes_report.pdf")


# ==================== Admin ====================

BATCH_FIELDS = ("batch_name", "description", "total_slots", "budget_allocation", "requirements", "min_gwa", "max_family_income")


def _apply_batch_fields(batch, data):
    for field in BATCH_FIELDS:
        if field in data:
            setattr(batch, field, data[field])
    for date_field in ("open_date", "registration_deadline"):
        if data.get(date_field):
            setattr(batch, date_field, date.fromisoformat(data[date_field]))


@spes_bp.get("/admin/spes/overview")
@jwt_required()
@role_required("admin")
def admin_spes_overview():
    total_applicants = SpesApplication.query.count()
    active_batches = SpesBatch.query.filter_by(status="open").count()
    upcoming = SpesBatch.query.filter(SpesBatch.status == "open", SpesBatch.registration_deadline >= now_manila().date()).order_by(SpesBatch.registration_deadline.asc()).limit(5).all()
    return ok({
        "total_applicants": total_applicants,
        "active_batches": active_batches,
        "upcoming_deadlines": [
            {"batch_id": str(b.id), "batch_name": b.batch_name, "registration_deadline": b.registration_deadline.isoformat()}
            for b in upcoming
        ],
        "funnel": spes_reporting_service.build_spes_stats(),
    })


@spes_bp.post("/admin/spes/batches")
@jwt_required()
@role_required("admin")
def admin_create_spes_batch():
    data = request.get_json(force=True) or {}
    if not data.get("batch_name") or not data.get("open_date") or not data.get("registration_deadline") or not data.get("total_slots"):
        return fail("Batch name, open date, registration deadline, and total slots are required.", 400)

    batch = SpesBatch(status="open", created_by=get_jwt_identity(), batch_name="", open_date=date.fromisoformat(data["open_date"]), registration_deadline=date.fromisoformat(data["registration_deadline"]), total_slots=int(data["total_slots"]))
    _apply_batch_fields(batch, data)
    db.session.add(batch)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "spes_batch", batch.id)
    return ok(batch.to_dict(), "Batch created.", 201)


@spes_bp.put("/admin/spes/batches/<batch_id>")
@jwt_required()
@role_required("admin")
def admin_update_spes_batch(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status != "open":
        return fail("Only an open batch can be edited.", 400)
    data = request.get_json(force=True) or {}
    _apply_batch_fields(batch, data)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_batch", batch.id)
    return ok(batch.to_dict(), "Batch updated.")


@spes_bp.put("/admin/spes/batches/<batch_id>/close")
@jwt_required()
@role_required("admin")
def admin_close_spes_batch(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status != "open":
        return fail("Only an open batch can be closed.", 400)
    batch.status = "closed"
    batch.closed_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_batch", batch.id, details="Closed")
    return ok(batch.to_dict(), "Batch closed.")


@spes_bp.put("/admin/spes/batches/<batch_id>/archive")
@jwt_required()
@role_required("admin")
def admin_archive_spes_batch(batch_id):
    batch = SpesBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status == "archived":
        return fail("This batch is already archived.", 400)
    batch.status = "archived"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_batch", batch.id, details="Archived")
    return ok(batch.to_dict(), "Batch archived.")


@spes_bp.get("/admin/spes/applications")
@jwt_required()
@role_required("staff", "admin")
def admin_list_spes_applications():
    applications = _query_spes_applications(request.args)
    return ok([a.to_dict() for a in applications])
