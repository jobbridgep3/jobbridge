"""DILP (DOLE Integrated Livelihood Program) module — jobseeker submits a livelihood
proposal, PESO Staff assigns an interview date/time, records the interview outcome, and
drives the application through every remaining stage (claiming, approval, ESFO
submission). No jobseeker action is required after submission — every step from
`scheduled` onward is staff-driven; the jobseeker only receives notifications and,
physically, attends the interview and later visits PESO to claim the document.

Standalone from blueprints/programs.py (the shared SPES/DILP/OWWA generic system) — like
SPES and OWWA before it, DILP's real status lifecycle doesn't fit the shared
PROGRAM_STATUSES enum. Old program_applications rows with program_type='dilp' from before
this upgrade are not migrated.

Admin has read-only visibility only (list/detail/stats/analytics/export) — every
status-mutating action below is gated to "staff" alone, not "admin"."""

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import selectinload

from extensions import db
from models.dilp import DilpApplication, DilpApplicationDocument, DilpApplicationRemark, DilpStatusHistory
from models.jobseeker import JobseekerProfile
from models.user import User
from services import dilp_reporting_service
from services.audit_service import log_audit
from services.email_service import (
    send_dilp_approved_email,
    send_dilp_interview_completed_email,
    send_dilp_interview_scheduled_email,
    send_dilp_no_show_email,
    send_dilp_ready_for_claiming_email,
    send_dilp_submitted_to_esfo_email,
)
from services.excel_service import build_excel_report
from services.notification_service import notify_board, notify_role, notify_user
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import manila_day_bounds, now_manila, parse_manila, to_manila

dilp_bp = Blueprint("dilp", __name__, url_prefix="/api")

_EAGER_LOAD = (selectinload(DilpApplication.jobseeker_profile).selectinload(JobseekerProfile.user),)

# new_status -> (email_fn, title, jobseeker_message)
_TRANSITION_EMAILS = {
    "scheduled": send_dilp_interview_scheduled_email,
    "completed": send_dilp_interview_completed_email,
    "ready_for_claiming": send_dilp_ready_for_claiming_email,
    "approved": send_dilp_approved_email,
    "submitted_to_esfo": send_dilp_submitted_to_esfo_email,
    "no_show": send_dilp_no_show_email,
}

_STATUS_NOTIFICATIONS = {
    "scheduled": ("DILP interview scheduled", "Your interview has been scheduled. Check your application for the date and time."),
    "completed": ("DILP interview completed", "Please proceed to the PESO Office for finalization and the Mayor's signature."),
    "no_show": ("DILP interview — missed appointment", "You were marked absent for your scheduled interview. Contact PESO to reschedule."),
    "ready_for_claiming": ("DILP proposal ready for claiming", "Your signed proposal is ready for claiming at the PESO Office."),
    "approved": ("DILP proposal approved", "Your DILP proposal has been officially approved."),
    "submitted_to_esfo": ("DILP submitted for funding", "Your application has been submitted to ESFO for funding processing."),
}


def _notify_jobseeker(dilp_app: DilpApplication, title: str, message: str):
    notify_user(
        dilp_app.jobseeker_profile.user_id, "dilp_status", title, message,
        link="/jobseeker/dilp",
        socket_event="dilp:status_change",
        socket_payload={"application_id": str(dilp_app.id), "new_status": dilp_app.status},
    )


def _notify_board(dilp_app: DilpApplication, title: str, message: str):
    notify_board(
        [("staff", f"/staff/dilp/{dilp_app.id}"), ("admin", "/admin/dilp")],
        "dilp_board", title, message,
        socket_event="dilp:board_update",
        socket_payload={"id": str(dilp_app.id)},
    )


def _ping_board(dilp_app_id):
    """Lightweight live-refresh ping (no persisted bell notification) for low-stakes events
    like an internal remark being added."""
    payload = {"id": str(dilp_app_id)}
    notify_role("staff", "dilp:board_update", payload)
    notify_role("admin", "dilp:board_update", payload)


def _interview_date_time_strings(dilp_app: DilpApplication):
    """interview_at is written via parse_manila, but Flask-SQLAlchemy expires ORM objects
    on commit (default expire_on_commit=True) — a post-commit attribute access re-fetches
    from Postgres, and no DB session here pins Asia/Manila, so the re-fetched value comes
    back UTC-tagged. to_manila() is safe to call regardless of which case this is: it always
    converts *to* Manila from whatever tzinfo is actually present, so it's a no-op for an
    already-Manila-aware value and a correct conversion for a UTC-re-fetched one — never a
    double conversion. Formatting the raw attribute directly (bypassing this) is what
    produced the "10:00 AM shows as 2:00 AM in the email" bug."""
    if not dilp_app.interview_at:
        return None, None
    manila_dt = to_manila(dilp_app.interview_at)
    return manila_dt.strftime("%B %d, %Y"), manila_dt.strftime("%I:%M %p")


def _record_transition(dilp_app: DilpApplication, new_status: str, actor_user: User, note: str = None):
    """Single source of truth for every DILP status transition — every endpoint that
    changes status must go through this so the timeline, audit trail, notification, and
    email always stay in sync."""
    old_status = dilp_app.status
    dilp_app.status = new_status
    db.session.add(DilpStatusHistory(
        dilp_application_id=dilp_app.id, from_status=old_status, to_status=new_status,
        changed_by=actor_user.id, note=note,
    ))
    db.session.commit()
    log_audit(actor_user, "Update", "dilp_application", dilp_app.id, f"Status: {old_status} -> {new_status}" + (f" — {note}" if note else ""))

    profile = dilp_app.jobseeker_profile
    email_fn = _TRANSITION_EMAILS.get(new_status)
    if email_fn and profile and profile.user:
        date_str, time_str = _interview_date_time_strings(dilp_app)
        if new_status == "scheduled":
            email_fn(profile.user.email, profile.full_name, date_str, time_str)
        elif new_status == "completed":
            email_fn(profile.user.email, profile.full_name, date_str)
        elif new_status == "no_show":
            email_fn(profile.user.email, profile.full_name, date_str)
        else:
            email_fn(profile.user.email, profile.full_name)

    title, message = _STATUS_NOTIFICATIONS.get(new_status, (f"DILP application {new_status}", None))
    _notify_jobseeker(dilp_app, title, message)
    _notify_board(dilp_app, title, f"{profile.full_name if profile else 'An applicant'}'s DILP application was marked {new_status.replace('_', ' ')}.")


def _apply_dilp_filters(query, args):
    """Single source of truth for DILP status/search/date-range filtering — used by the
    staff queue, Excel export, and PDF export alike, so the table and every export can
    never disagree about which records match the active filters."""
    if args.get("status"):
        query = query.filter(DilpApplication.status == args["status"])
    if args.get("search"):
        query = query.filter(JobseekerProfile.full_name.ilike(f"%{args['search']}%"))
    start, end = manila_day_bounds(args.get("date_from"), args.get("date_to"))
    if start:
        query = query.filter(DilpApplication.created_at >= start)
    if end:
        query = query.filter(DilpApplication.created_at < end)
    return query


def _transition(application_id, expected_statuses, error_message):
    dilp_app = DilpApplication.query.get(application_id)
    if not dilp_app:
        return None, fail("Application not found.", 404)
    if dilp_app.status not in expected_statuses:
        return None, fail(error_message, 400)
    return dilp_app, None


# ---------- Jobseeker ----------

@dilp_bp.get("/dilp/my")
@jwt_required()
@role_required("jobseeker")
def my_dilp_applications():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    applications = DilpApplication.query.options(*_EAGER_LOAD).filter_by(
        jobseeker_profile_id=profile.id
    ).order_by(DilpApplication.created_at.desc()).all()
    return ok([a.to_dict(include_documents=True, include_remarks=True, include_history=True) for a in applications])


@dilp_bp.post("/dilp/apply")
@jwt_required()
@role_required("jobseeker")
def apply_dilp():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)

    data = request.get_json(force=True) or {}
    proposed_livelihood = (data.get("proposed_livelihood") or "").strip()
    business_description = (data.get("business_description") or "").strip()
    capital_needed = data.get("capital_needed")
    if not proposed_livelihood:
        return fail("Proposed livelihood/business name is required.", 400)
    if not business_description:
        return fail("Business description/justification is required.", 400)
    try:
        capital_needed = float(capital_needed)
        if capital_needed <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return fail("Capital needed must be a positive number.", 400)

    dilp_app = DilpApplication(
        jobseeker_profile_id=profile.id, status="pending",
        proposed_livelihood=proposed_livelihood, business_description=business_description,
        capital_needed=capital_needed,
    )
    db.session.add(dilp_app)
    db.session.commit()
    db.session.add(DilpStatusHistory(dilp_application_id=dilp_app.id, from_status=None, to_status="pending", changed_by=None))
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "dilp_application", dilp_app.id)

    _notify_jobseeker(dilp_app, "DILP application received", "Your application is under review. You will be notified once your interview is scheduled.")
    _notify_board(dilp_app, "New DILP application", f"{profile.full_name} submitted a new DILP application.")

    has_other_active = DilpApplication.query.filter(
        DilpApplication.jobseeker_profile_id == profile.id,
        DilpApplication.id != dilp_app.id,
        DilpApplication.status != "submitted_to_esfo",
    ).first() is not None

    result = dilp_app.to_dict()
    result["has_other_active_application"] = has_other_active
    return ok(result, "Your DILP application has been submitted. You will be notified once your interview is scheduled.", 201)


def _get_own_editable_application(application_id, user_id):
    profile = JobseekerProfile.query.filter_by(user_id=user_id).first()
    dilp_app = DilpApplication.query.get(application_id)
    if not dilp_app or not profile or dilp_app.jobseeker_profile_id != profile.id:
        return None, fail("Application not found.", 404)
    if dilp_app.status != "pending":
        return None, fail("Documents can only be added while your application is pending review.", 400)
    return dilp_app, None


@dilp_bp.post("/dilp/<application_id>/documents")
@jwt_required()
@role_required("jobseeker")
def upload_dilp_document(application_id):
    from services.ocr_service import extract_text_from_resume
    from services.storage_service import upload_file, validate_upload_file

    dilp_app, error = _get_own_editable_application(application_id, get_jwt_identity())
    if error:
        return error
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    validation_error = validate_upload_file(file_bytes, file.filename)
    if validation_error:
        return fail(validation_error, 400)

    application_id = dilp_app.id
    # Release the DB connection before the slow, blocking Storage upload + Vision OCR
    # calls — see the identical comment in blueprints/owwa.py's upload handler.
    db.session.close()

    url = upload_file(file_bytes, file.filename, folder=f"dilp-docs/{application_id}", content_type=file.mimetype)
    result = extract_text_from_resume(file_bytes, file.filename)
    ocr_text = (result["text"] or "")[:2000] if result["mode"] == "real" else ""

    document = DilpApplicationDocument(
        dilp_application_id=application_id, file_url=url, original_filename=file.filename, ocr_text=ocr_text,
    )
    db.session.add(document)
    db.session.commit()
    return ok(document.to_dict(), "Document uploaded.", 201)


@dilp_bp.delete("/dilp/documents/<document_id>")
@jwt_required()
@role_required("jobseeker")
def delete_dilp_document(document_id):
    document = DilpApplicationDocument.query.get(document_id)
    if not document:
        return fail("Document not found.", 404)
    _, error = _get_own_editable_application(document.dilp_application_id, get_jwt_identity())
    if error:
        return error

    db.session.delete(document)
    db.session.commit()
    return ok(None, "Document removed.")


# ---------- Staff (+ admin, read-only from the frontend) ----------

@dilp_bp.get("/staff/dilp/queue")
@jwt_required()
@role_required("staff", "admin")
def staff_dilp_queue():
    query = DilpApplication.query.options(*_EAGER_LOAD).join(JobseekerProfile)
    query = _apply_dilp_filters(query, request.args)
    applications = query.order_by(DilpApplication.created_at.desc()).all()
    return ok([a.to_dict() for a in applications])


@dilp_bp.get("/staff/dilp/<application_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_dilp_detail(application_id):
    dilp_app = DilpApplication.query.options(
        *_EAGER_LOAD, selectinload(DilpApplication.documents),
        selectinload(DilpApplication.remarks).selectinload(DilpApplicationRemark.staff),
        selectinload(DilpApplication.status_history).selectinload(DilpStatusHistory.changed_by_user),
    ).get(application_id)
    if not dilp_app:
        return fail("Application not found.", 404)
    return ok(dilp_app.to_dict(include_documents=True, include_remarks=True, include_history=True))


@dilp_bp.get("/staff/dilp/stats")
@jwt_required()
@role_required("staff", "admin")
def staff_dilp_stats():
    return ok(dilp_reporting_service.build_dilp_stats())


@dilp_bp.get("/staff/dilp/analytics")
@jwt_required()
@role_required("staff", "admin")
def staff_dilp_analytics():
    months = int(request.args.get("months", 6))
    return ok(dilp_reporting_service.build_dilp_analytics(months))


def _parse_dilp_report_filters(args):
    return {
        "status": args.get("status") or None,
        "search": args.get("search") or None,
        "date_from": args.get("date_from") or None,
        "date_to": args.get("date_to") or None,
    }


# Applicant-detail columns only — no DILP-process fields (livelihood/capital/interview/
# claiming/approval dates), no stats/metrics/analytics, per the export content requirement.
# (spes_report_row() dict key, header label) pairs, shared by both the Excel sheet and the
# PDF table so the two exports can never show different columns for the same filtered data.
_DILP_APPLICATION_COLUMNS = [
    ("full_name", "Full Name"), ("email", "Email"), ("contact_number", "Contact Number"),
    ("date_of_birth", "Date of Birth"), ("age", "Age"), ("gender", "Gender"),
    ("civil_status", "Civil Status"), ("nationality", "Nationality"), ("address", "Complete Address"),
    ("barangay", "Barangay"), ("municipality", "Municipality"), ("province", "Province"),
    ("application_date", "DILP Application Date"), ("status_label", "DILP Status"),
    ("stage_label", "Current Application Stage"),
]

_DILP_NO_MATCH_MESSAGE = "No applicants matched the selected filters."


def _dilp_application_row_values(d):
    return [d.get(key) for key, _label in _DILP_APPLICATION_COLUMNS]


@dilp_bp.get("/staff/dilp/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_dilp_excel():
    filters = _parse_dilp_report_filters(request.args)
    applications = dilp_reporting_service.query_dilp_applications_for_report(**filters)
    user = User.query.get(get_jwt_identity())

    rows = [dilp_reporting_service.dilp_report_row(a) for a in applications]
    if rows:
        columns = [label for _key, label in _DILP_APPLICATION_COLUMNS]
        application_rows = [_dilp_application_row_values(d) for d in rows]
    else:
        columns = ["Notice"]
        application_rows = [[_DILP_NO_MATCH_MESSAGE]]

    buf = build_excel_report("DILP Applicants", columns, application_rows, landscape=True)
    log_audit(user, "Export", "dilp_report", details="excel")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name="dilp_report.xlsx",
    )


@dilp_bp.get("/staff/dilp/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_dilp_pdf():
    from services.pdf_service import generate_dilp_report, to_bytesio

    filters = _parse_dilp_report_filters(request.args)
    applications = dilp_reporting_service.query_dilp_applications_for_report(**filters)
    user = User.query.get(get_jwt_identity())
    date_str = now_manila().strftime("%B %d, %Y %I:%M %p")

    rows = [dilp_reporting_service.dilp_report_row(a) for a in applications]
    pdf_bytes = generate_dilp_report(rows, date_str, user.email, user.role, columns=_DILP_APPLICATION_COLUMNS)
    log_audit(user, "Export", "dilp_report", details="pdf")
    return send_file(
        to_bytesio(pdf_bytes), mimetype="application/pdf",
        as_attachment=True, download_name="dilp_report.pdf",
    )


# ---------- Staff-only mutations (never admin) ----------

@dilp_bp.post("/staff/dilp/<application_id>/remarks")
@jwt_required()
@role_required("staff")
def staff_add_dilp_remark(application_id):
    dilp_app = DilpApplication.query.get(application_id)
    if not dilp_app:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    remark_text = (data.get("remark") or "").strip()
    if not remark_text:
        return fail("Remark text is required.", 400)

    remark = DilpApplicationRemark(dilp_application_id=application_id, staff_id=get_jwt_identity(), remark=remark_text)
    db.session.add(remark)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "dilp_application_remark", dilp_app.id)
    _ping_board(dilp_app.id)
    return ok(remark.to_dict(), "Remark added.", 201)


@dilp_bp.put("/staff/dilp/<application_id>/schedule")
@jwt_required()
@role_required("staff")
def staff_schedule_dilp(application_id):
    dilp_app, error = _transition(application_id, ("pending", "no_show"), "Only pending or no-show applications can be scheduled.")
    if error:
        return error
    data = request.get_json(force=True) or {}
    interview_date = (data.get("interview_date") or "").strip()
    interview_time = (data.get("interview_time") or "").strip()
    if not interview_date or not interview_time:
        return fail("An interview date and time are required.", 400)
    try:
        interview_at = parse_manila(f"{interview_date}T{interview_time}")
    except ValueError:
        return fail("Invalid interview date/time.", 400)

    was_reschedule = dilp_app.status == "no_show"
    dilp_app.interview_at = interview_at
    dilp_app.staff_id = get_jwt_identity()
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "scheduled", actor, note="Rescheduled after no-show." if was_reschedule else None)
    return ok(dilp_app.to_dict(), "Interview scheduled.")


@dilp_bp.put("/staff/dilp/<application_id>/complete")
@jwt_required()
@role_required("staff")
def staff_complete_dilp(application_id):
    dilp_app, error = _transition(application_id, ("scheduled",), "Only scheduled applications can be marked completed.")
    if error:
        return error
    dilp_app.completed_at = now_manila()
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "completed", actor)
    return ok(dilp_app.to_dict(), "Interview marked as completed.")


@dilp_bp.put("/staff/dilp/<application_id>/no-show")
@jwt_required()
@role_required("staff")
def staff_no_show_dilp(application_id):
    dilp_app, error = _transition(application_id, ("scheduled",), "Only scheduled applications can be marked no-show.")
    if error:
        return error
    dilp_app.no_show_count = (dilp_app.no_show_count or 0) + 1
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "no_show", actor)
    return ok(dilp_app.to_dict(), "Applicant marked as no-show.")


@dilp_bp.put("/staff/dilp/<application_id>/ready-for-claiming")
@jwt_required()
@role_required("staff")
def staff_ready_for_claiming_dilp(application_id):
    dilp_app, error = _transition(application_id, ("completed",), "Only completed applications can be marked ready for claiming.")
    if error:
        return error
    dilp_app.ready_for_claiming_at = now_manila()
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "ready_for_claiming", actor)
    return ok(dilp_app.to_dict(), "Application marked ready for claiming.")


@dilp_bp.put("/staff/dilp/<application_id>/approve")
@jwt_required()
@role_required("staff")
def staff_approve_dilp(application_id):
    dilp_app, error = _transition(application_id, ("ready_for_claiming",), "Only applications ready for claiming can be approved.")
    if error:
        return error
    dilp_app.approved_at = now_manila()
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "approved", actor)
    return ok(dilp_app.to_dict(), "Application marked as approved.")


@dilp_bp.put("/staff/dilp/<application_id>/submit-to-esfo")
@jwt_required()
@role_required("staff")
def staff_submit_to_esfo_dilp(application_id):
    dilp_app, error = _transition(application_id, ("approved",), "Only approved applications can be submitted to ESFO.")
    if error:
        return error
    dilp_app.submitted_to_esfo_at = now_manila()
    actor = User.query.get(get_jwt_identity())
    _record_transition(dilp_app, "submitted_to_esfo", actor)
    return ok(dilp_app.to_dict(), "Application submitted to ESFO.")
