"""SPES (Special Program for Employment of Students) module — batch creation,
registration + eligibility validation, application review, independent
orientation/exam scheduling + QR attendance, orientation-result/exam-result
encoding, and a PESO-office appointment once an applicant passes. Standalone from
blueprints/programs.py (the shared SPES/DILP generic system) — see models/spes.py's
module docstring for why.

There is no Deployment/DTR tracking in this module — PESO coordinates placement in
person once an applicant passes the exam; the system's involvement ends with the
PESO-office appointment (see staff_set_peso_appointment below).

Admin is restricted to batch management + reports (system-wide); every day-to-day
operational action (application review, scheduling, QR scanning, outcome/result
encoding, PESO appointment) is Staff-only, enforced via role_required("staff")
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
from models.spes import SPES_ATTENDANCE_EVENT_TYPES, SpesApplication, SpesAttendanceLog, SpesBatch
from models.user import User
from services import spes_reporting_service, spes_service
from services.audit_service import log_audit
from services.email_service import (
    send_spes_exam_notice_email,
    send_spes_orientation_notice_email,
    send_spes_peso_appointment_email,
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
    return ok([a.to_dict(include_attendance=True) for a in applications])


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
    application = SpesApplication.query.options(*_APP_EAGER, selectinload(SpesApplication.attendance_logs)).get(application_id)
    if not application:
        return fail("Application not found.", 404)
    return ok(application.to_dict(include_attendance=True))


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
    count = SpesApplication.query.filter_by(batch_id=batch_id, status="orientation_passed").count()
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
    applications = SpesApplication.query.options(*_APP_EAGER).filter_by(batch_id=batch.id, status="orientation_passed").all()
    for application in applications:
        send_spes_exam_notice_email(
            application.jobseeker_profile.user.email, application.full_name, batch.batch_name, date_str, time_str, venue, dress_code,
        )
        _notify_jobseeker(application, "SPES exam scheduled", f"Your SPES exam for {batch.batch_name} is scheduled on {date_str} at {time_str}.")
    return ok(batch.to_dict(), f"Exam schedule saved — {len(applications)} applicant(s) notified.")


# Maps an attendance scan's event_type to the (required-precondition-status, resulting-status)
# pair — QR attendance automatically advances the applicant; Staff never manually assigns
# "attended" separately (see staff_set_orientation_result/staff_set_exam_result for the
# distinct, Staff-driven pass/fail decision that follows attendance).
_SCAN_TRANSITIONS = {
    "orientation": ("approved_for_orientation", "attended_orientation", "This applicant hasn't been approved for orientation yet."),
    "exam": ("orientation_passed", "attended_exam", "This applicant hasn't passed orientation yet — exam attendance can't be recorded."),
}


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

    required_status, resulting_status, precondition_error = _SCAN_TRANSITIONS[event_type]
    if application.status != required_status:
        return fail(f"{application.full_name}: {precondition_error}", 409)

    log = SpesAttendanceLog(application_id=application.id, event_type=event_type, scanned_at=now_manila(), scanned_by=get_jwt_identity())
    db.session.add(log)
    application.status = resulting_status
    db.session.commit()

    _notify_jobseeker(
        application, f"SPES {event_type} attendance recorded",
        f"You've been marked present for {event_type}.",
    )
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
        else spes_reporting_service.ORIENTATION_PASSED_STATUSES
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


def _set_orientation_result(application, result, remarks):
    """Orientation attendance is already automatic (see staff_scan_spes_qr) — this
    records Staff's separate Passed/Failed judgment for an applicant who attended."""
    if application.status != "attended_orientation":
        return fail(f"{application.full_name}: only applicants who attended orientation can have a result recorded.", 400)
    application.status = "orientation_passed" if result == "passed" else "failed_orientation"
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
    result = data.get("result")
    if result not in ("passed", "failed"):
        return fail("Result must be 'passed' or 'failed'.", 400)

    error = _set_orientation_result(application, result, data.get("remarks"))
    if error:
        return error
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details=f"Orientation result: {result}")
    _notify_jobseeker(application, "SPES orientation result recorded", f"Your orientation/interview result has been recorded: {application.status.replace('_', ' ').title()}.")
    return ok(application.to_dict(), "Orientation result saved.")


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
        result = item.get("result")
        if result not in ("passed", "failed"):
            errors.append({"application_id": item.get("application_id"), "error": "Invalid result."})
            continue
        error = _set_orientation_result(application, result, item.get("remarks"))
        if error:
            errors.append({"application_id": item.get("application_id"), "error": "Not eligible for an orientation result."})
            continue
        saved.append(application)
    db.session.commit()
    for application in saved:
        log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details="Orientation result (bulk)")
        _notify_jobseeker(application, "SPES orientation result recorded", f"Your orientation/interview result has been recorded: {application.status.replace('_', ' ').title()}.")
    return ok({"saved": len(saved), "errors": errors}, f"{len(saved)} result(s) saved.")


def _set_exam_result(application, result, remarks):
    if application.status != "attended_exam":
        return None, fail(f"{application.full_name}: only applicants who attended the exam can have a result recorded.", 400)
    application.status = "passed" if result == "passed" else "failed"
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


@spes_bp.put("/staff/spes/applications/<application_id>/peso-appointment")
@jwt_required()
@role_required("staff")
def staff_set_spes_peso_appointment(application_id):
    """Only step after an exam pass — no Deployment/DTR tracking. Staff schedules a
    PESO-office visit; the applicant is emailed and the SPES cycle's system
    involvement ends here."""
    application = SpesApplication.query.options(*_APP_EAGER).get(application_id)
    if not application:
        return fail("Application not found.", 404)
    if application.status != "passed":
        return fail("Only applicants who passed the exam can have a PESO appointment set.", 400)

    data = request.get_json(force=True) or {}
    date_str = (data.get("date") or "").strip()
    time_str = (data.get("time") or "").strip()
    if not date_str or not time_str:
        return fail("Date and time are required.", 400)
    try:
        appointment_at = MANILA_TZ.localize(datetime.fromisoformat(f"{date_str}T{time_str}"))
    except ValueError:
        return fail("Invalid date/time.", 400)

    application.peso_appointment_at = appointment_at
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "spes_application", application.id, details="Set PESO appointment")

    appt_date_str = appointment_at.strftime("%B %d, %Y")
    appt_time_str = appointment_at.strftime("%I:%M %p")
    send_spes_peso_appointment_email(
        application.jobseeker_profile.user.email, application.full_name, application.batch.batch_name, appt_date_str, appt_time_str,
    )
    _notify_jobseeker(application, "SPES PESO appointment scheduled", f"Proceed to the PESO Office on {appt_date_str} at {appt_time_str}.")
    return ok(application.to_dict(), "PESO appointment saved.")


# ---------- Reporting (staff + admin, read-only) ----------

def _parse_spes_report_filters(args):
    return {
        "batch_id": args.get("batch_id") or None,
        "status": args.get("status") or None,
        "attendance": args.get("attendance") or None,
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


# Dashboard-only stat keys (live "needs action now" counts) that don't belong in a
# formal exported report alongside their cumulative report-facing counterparts.
_EXPORT_EXCLUDED_STAT_KEYS = {"currently_orientation_passed"}


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
        *[[SPES_STAT_LABELS.get(k, k), v] for k, v in stats.items() if k not in _EXPORT_EXCLUDED_STAT_KEYS],
    ]
    rows = [spes_reporting_service.spes_report_row(a) for a in applications]
    orientation_rows = [
        [d["application_ref_no"], d["jobseeker_name"], d["batch_name"], "Attended" if d["orientation_attended"] else "Absent", d["status"]]
        for d in rows
    ]
    exam_rows = [
        [d["application_ref_no"], d["jobseeker_name"], d["batch_name"], "Attended" if d["exam_attended"] else "Absent", d["status"]]
        for d in rows
    ]

    buf = build_multi_sheet_excel_report([
        ("Summary", ["PESO Pila, Laguna — SPES Program Report", ""], summary_rows),
        ("Orientation Results", ["Reference #", "Applicant", "Batch", "Attendance", "Status"], orientation_rows),
        ("Exam Results", ["Reference #", "Applicant", "Batch", "Attendance", "Status"], exam_rows),
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
    batch_name = SpesBatch.query.get(filters["batch_id"]).batch_name if filters["batch_id"] else None

    display_stats = {k: v for k, v in stats.items() if k not in _EXPORT_EXCLUDED_STAT_KEYS}
    rows = [spes_reporting_service.spes_report_row(a) for a in applications]
    pdf_bytes = generate_spes_report(display_stats, rows, date_str, user.email, user.role, batch_name=batch_name)
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
