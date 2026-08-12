"""OWWA Assistance Program module — jobseeker/OFW-beneficiary submits a request,
PESO Staff verifies eligibility (offline, via the OWWA Hotline), submits to OWWA
Region IV-A (offline), and follows up until OWWA responds. Actual OWWA eligibility
determination, benefit computation, and disbursement stay fully offline/manual at
OWWA Region IV-A — this module only tracks the referral pipeline up to OWWA's
response, mirroring the ManPower Skills Training Referral module's shape.

Standalone from blueprints/programs.py (the shared SPES/DILP/OWWA generic system)
— this module's status lifecycle doesn't fit that shared enum, so SPES/DILP stay
on the generic system untouched, and program_applications rows with
program_type='owwa' from before this upgrade are not migrated."""

from datetime import date, datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import selectinload

from extensions import db
from models.jobseeker import JobseekerProfile
from models.owwa import OwwaRequest, OwwaRequestDocument, OwwaRequestRemark
from models.user import User
from services import owwa_reporting_service
from services.audit_service import log_audit
from services.email_service import (
    send_owwa_request_awaiting_response_email,
    send_owwa_request_completed_email,
    send_owwa_request_declined_email,
    send_owwa_request_received_email,
    send_owwa_request_submitted_email,
    send_owwa_request_verified_email,
)
from services.excel_service import build_multi_sheet_excel_report
from services.notification_service import notify_role, notify_user
from services.pdf_service import generate_owwa_report, to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok

owwa_bp = Blueprint("owwa", __name__, url_prefix="/api")

_EAGER_LOAD = (selectinload(OwwaRequest.jobseeker_profile).selectinload(JobseekerProfile.user),)


def _notify_jobseeker(owwa_request: OwwaRequest, title: str, message: str):
    notify_user(
        owwa_request.jobseeker_profile.user_id, "owwa_request_status", title, message,
        link="/jobseeker/owwa",
        socket_event="owwa:status_change",
        socket_payload={"request_id": str(owwa_request.id), "new_status": owwa_request.status},
    )


def _notify_board(record_id, title: str, message: str):
    """Persisted (bell + unread count) notification for every active staff + admin
    user, same corrected pattern as manpower_training.py's _notify_board — not the
    ephemeral notify_role-only approach the ManPower module initially shipped with."""
    payload = {"id": str(record_id)}
    for role, link in (("staff", f"/staff/owwa/{record_id}"), ("admin", "/admin/owwa")):
        for user in User.query.filter_by(role=role, is_active=True).all():
            notify_user(
                user.id, "owwa_board", title, message, link=link,
                socket_event="owwa:board_update", socket_payload=payload,
            )


def _ping_board(record_id):
    """Lightweight live-refresh ping (no persisted bell notification) for low-stakes
    events like an internal remark being added — other staff viewing the same
    request live-sync without every internal note cluttering everyone's inbox."""
    payload = {"id": str(record_id)}
    notify_role("staff", "owwa:board_update", payload)
    notify_role("admin", "owwa:board_update", payload)


# ---------- Jobseeker ----------

@owwa_bp.get("/owwa/my")
@jwt_required()
@role_required("jobseeker")
def my_owwa_requests():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    requests_ = OwwaRequest.query.options(*_EAGER_LOAD, selectinload(OwwaRequest.documents)).filter_by(
        jobseeker_profile_id=profile.id
    ).order_by(OwwaRequest.created_at.desc()).all()
    return ok([r.to_dict(include_documents=True) for r in requests_])


@owwa_bp.post("/owwa/apply")
@jwt_required()
@role_required("jobseeker")
def apply_owwa_request():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)

    data = request.get_json(force=True) or {}
    ofw_relationship = (data.get("ofw_relationship") or "").strip()
    if not ofw_relationship:
        return fail("OFW status / relationship to OFW is required.", 400)

    owwa_request = OwwaRequest(
        jobseeker_profile_id=profile.id,
        ofw_relationship=ofw_relationship,
        notes=data.get("notes"),
        status="pending",
        submitted_at=datetime.utcnow(),
    )
    db.session.add(owwa_request)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "owwa_request", owwa_request.id)

    request_dict = owwa_request.to_dict()
    profile_dict = profile.to_dict()
    profile_email = profile.user.email
    profile_full_name = profile.full_name
    submitted_at = owwa_request.submitted_at
    owwa_request_id = owwa_request.id

    # Release the DB connection before the slow, blocking PDF render + Storage
    # upload call — see the identical comment in blueprints/manpower_training.py's
    # upload handler.
    db.session.close()

    from services.pdf_service import generate_owwa_application_form
    from services.storage_service import upload_file

    pdf_bytes = generate_owwa_application_form(request_dict, profile_dict, profile_email)
    filename = f"OWWA_Application_Form_{owwa_request_id}.pdf"
    file_url = upload_file(pdf_bytes, filename, folder=f"owwa-docs/{owwa_request_id}/application_form", content_type="application/pdf")

    db.session.add(OwwaRequestDocument(
        owwa_request_id=owwa_request_id, document_type="application_form", file_url=file_url, original_filename=filename,
    ))
    db.session.commit()

    owwa_request = OwwaRequest.query.get(owwa_request_id)
    send_owwa_request_received_email(profile_email, profile_full_name, str(owwa_request_id), submitted_at.strftime("%B %d, %Y"))
    _notify_jobseeker(owwa_request, "OWWA Assistance request received", "Your request is under review by PESO staff.")
    _notify_board(owwa_request_id, "New OWWA Assistance request", f"{profile_full_name} submitted a new OWWA Assistance request.")

    return ok(owwa_request.to_dict(include_documents=True), "OWWA Assistance request submitted.", 201)


def _get_own_pending_request(request_id, user_id):
    profile = JobseekerProfile.query.filter_by(user_id=user_id).first()
    owwa_request = OwwaRequest.query.get(request_id)
    if not owwa_request or not profile or owwa_request.jobseeker_profile_id != profile.id:
        return None, fail("Request not found.", 404)
    if owwa_request.status != "pending":
        return None, fail("Documents can only be added while your request is pending review.", 400)
    return owwa_request, None


@owwa_bp.post("/owwa/<request_id>/documents")
@jwt_required()
@role_required("jobseeker")
def upload_owwa_document(request_id):
    from services.storage_service import upload_file, validate_upload_file

    owwa_request, error = _get_own_pending_request(request_id, get_jwt_identity())
    if error:
        return error

    document_type = request.form.get("document_type")
    if document_type == "application_form":
        return fail("The application form is generated automatically and cannot be uploaded manually.", 400)
    if document_type not in ("supporting_document",):
        return fail("Invalid document type.", 400)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    validation_error = validate_upload_file(file_bytes, file.filename)
    if validation_error:
        return fail(validation_error, 400)

    # Release the DB connection before the slow, blocking Storage upload call —
    # see the identical comment in blueprints/manpower_training.py's upload handler.
    db.session.close()

    file_url = upload_file(file_bytes, file.filename, folder=f"owwa-docs/{request_id}/{document_type}", content_type=file.mimetype)

    document = OwwaRequestDocument(
        owwa_request_id=request_id, document_type=document_type, file_url=file_url, original_filename=file.filename,
    )
    db.session.add(document)
    db.session.commit()
    return ok(document.to_dict(), "Document uploaded.", 201)


@owwa_bp.delete("/owwa/documents/<document_id>")
@jwt_required()
@role_required("jobseeker")
def delete_owwa_document(document_id):
    document = OwwaRequestDocument.query.get(document_id)
    if not document:
        return fail("Document not found.", 404)
    owwa_request, error = _get_own_pending_request(document.owwa_request_id, get_jwt_identity())
    if error:
        return error

    db.session.delete(document)
    db.session.commit()
    return ok(None, "Document removed.")


# ---------- Staff (+ admin, read-only from the frontend) ----------

@owwa_bp.get("/staff/owwa/queue")
@jwt_required()
@role_required("staff", "admin")
def staff_owwa_queue():
    query = OwwaRequest.query.options(*_EAGER_LOAD).join(JobseekerProfile)
    if request.args.get("status"):
        query = query.filter(OwwaRequest.status == request.args["status"])
    if request.args.get("search"):
        query = query.filter(JobseekerProfile.full_name.ilike(f"%{request.args['search']}%"))
    if request.args.get("date_from"):
        query = query.filter(OwwaRequest.submitted_at >= request.args["date_from"])
    if request.args.get("date_to"):
        query = query.filter(OwwaRequest.submitted_at <= request.args["date_to"] + "T23:59:59")

    requests_ = query.order_by(OwwaRequest.submitted_at.desc()).all()
    return ok([r.to_dict() for r in requests_])


@owwa_bp.get("/staff/owwa/<request_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_owwa_detail(request_id):
    owwa_request = OwwaRequest.query.options(
        *_EAGER_LOAD, selectinload(OwwaRequest.documents), selectinload(OwwaRequest.remarks).selectinload(OwwaRequestRemark.staff),
    ).get(request_id)
    if not owwa_request:
        return fail("Request not found.", 404)
    return ok(owwa_request.to_dict(include_documents=True, include_remarks=True))


@owwa_bp.post("/staff/owwa/<request_id>/remarks")
@jwt_required()
@role_required("staff", "admin")
def staff_add_owwa_remark(request_id):
    owwa_request = OwwaRequest.query.get(request_id)
    if not owwa_request:
        return fail("Request not found.", 404)
    data = request.get_json(force=True) or {}
    remark_text = (data.get("remark") or "").strip()
    if not remark_text:
        return fail("Remark text is required.", 400)

    remark = OwwaRequestRemark(owwa_request_id=request_id, staff_id=get_jwt_identity(), remark=remark_text)
    db.session.add(remark)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "owwa_request_remark", owwa_request.id)
    _ping_board(owwa_request.id)
    return ok(remark.to_dict(), "Remark added.", 201)


def _transition(request_id, expected_statuses, new_status, error_message):
    owwa_request = OwwaRequest.query.get(request_id)
    if not owwa_request:
        return None, fail("Request not found.", 404)
    if owwa_request.status not in expected_statuses:
        return None, fail(error_message, 400)
    owwa_request.status = new_status
    owwa_request.staff_id = get_jwt_identity()
    return owwa_request, None


@owwa_bp.put("/staff/owwa/<request_id>/verify")
@jwt_required()
@role_required("staff", "admin")
def staff_verify_owwa_request(request_id):
    owwa_request, error = _transition(request_id, ("pending",), "verified", "Only pending requests can be verified.")
    if error:
        return error
    owwa_request.verified_at = datetime.utcnow()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Verify", "owwa_request", owwa_request.id)

    profile = owwa_request.jobseeker_profile
    send_owwa_request_verified_email(profile.user.email, profile.full_name, str(owwa_request.id))
    _notify_jobseeker(owwa_request, "OWWA Assistance application verified", "Your application has been verified and is being finalized for submission to OWWA.")
    _notify_board(owwa_request.id, "OWWA request verified", f"{profile.full_name}'s request was verified.")

    return ok(owwa_request.to_dict(), "Request marked as verified.")


@owwa_bp.put("/staff/owwa/<request_id>/submit-to-owwa")
@jwt_required()
@role_required("staff", "admin")
def staff_submit_owwa_request(request_id):
    owwa_request, error = _transition(request_id, ("verified",), "submitted_to_owwa", "Only verified requests can be submitted to OWWA.")
    if error:
        return error
    owwa_request.submitted_to_owwa_at = datetime.utcnow()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Submit to OWWA", "owwa_request", owwa_request.id)

    profile = owwa_request.jobseeker_profile
    send_owwa_request_submitted_email(profile.user.email, profile.full_name, str(owwa_request.id))
    _notify_jobseeker(owwa_request, "OWWA Assistance application submitted", "Your application has been submitted to OWWA Region IV-A.")
    _notify_board(owwa_request.id, "OWWA request submitted to OWWA", f"{profile.full_name}'s request was submitted to OWWA.")

    return ok(owwa_request.to_dict(), "Request submitted to OWWA.")


@owwa_bp.put("/staff/owwa/<request_id>/follow-up")
@jwt_required()
@role_required("staff", "admin")
def staff_follow_up_owwa_request(request_id):
    owwa_request, error = _transition(
        request_id, ("submitted_to_owwa",), "for_owwa_response", "Only requests already submitted to OWWA can be marked for follow-up.",
    )
    if error:
        return error
    owwa_request.for_owwa_response_at = datetime.utcnow()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Follow Up", "owwa_request", owwa_request.id)

    profile = owwa_request.jobseeker_profile
    send_owwa_request_awaiting_response_email(profile.user.email, profile.full_name, str(owwa_request.id))
    _notify_jobseeker(owwa_request, "OWWA Assistance application update", "PESO Pila is following up with OWWA on your behalf.")
    _notify_board(owwa_request.id, "OWWA request awaiting response", f"{profile.full_name}'s request is awaiting OWWA response.")

    return ok(owwa_request.to_dict(), "Request marked as awaiting OWWA response.")


@owwa_bp.put("/staff/owwa/<request_id>/complete")
@jwt_required()
@role_required("staff", "admin")
def staff_complete_owwa_request(request_id):
    owwa_request, error = _transition(
        request_id, ("submitted_to_owwa", "for_owwa_response"), "completed", "Only requests submitted to OWWA can be marked completed.",
    )
    if error:
        return error
    data = request.get_json(force=True) or {}
    appointment_date = (data.get("appointment_date") or "").strip()
    appointment_time = (data.get("appointment_time") or "").strip()
    if not appointment_date or not appointment_time:
        db.session.rollback()
        return fail("A PESO appointment date and time are required to mark this request completed.", 400)
    try:
        appointment_at = datetime.fromisoformat(f"{appointment_date}T{appointment_time}")
    except ValueError:
        db.session.rollback()
        return fail("Invalid appointment date/time.", 400)

    owwa_request.completed_at = datetime.utcnow()
    owwa_request.appointment_at = appointment_at
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Mark Completed", "owwa_request", owwa_request.id)

    profile = owwa_request.jobseeker_profile
    send_owwa_request_completed_email(
        profile.user.email, profile.full_name, str(owwa_request.id),
        appointment_at.strftime("%B %d, %Y"), appointment_at.strftime("%I:%M %p"),
    )
    _notify_jobseeker(owwa_request, "OWWA Assistance application completed", "OWWA has processed your assistance. See your appointment details.")
    _notify_board(owwa_request.id, "OWWA request completed", f"{profile.full_name}'s request was marked completed.")

    return ok(owwa_request.to_dict(), "Request marked completed.")


@owwa_bp.put("/staff/owwa/<request_id>/decline")
@jwt_required()
@role_required("staff", "admin")
def staff_decline_owwa_request(request_id):
    owwa_request, error = _transition(
        request_id, ("pending", "verified", "submitted_to_owwa", "for_owwa_response"), "declined",
        "This request can no longer be declined.",
    )
    if error:
        return error
    data = request.get_json(force=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        db.session.rollback()
        return fail("A reason is required to decline this request.", 400)
    owwa_request.declined_at = datetime.utcnow()
    owwa_request.declined_reason = reason
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Decline", "owwa_request", owwa_request.id, details=reason)

    profile = owwa_request.jobseeker_profile
    send_owwa_request_declined_email(profile.user.email, profile.full_name, str(owwa_request.id), reason)
    _notify_jobseeker(owwa_request, "OWWA Assistance application declined", reason)
    _notify_board(owwa_request.id, "OWWA request declined", f"{profile.full_name}'s request was declined. Reason: {reason}")

    return ok(owwa_request.to_dict(), "Request marked declined.")


# ---------- Reporting (staff + admin, additive/read-only) ----------

@owwa_bp.get("/staff/owwa/stats")
@jwt_required()
@role_required("staff", "admin")
def staff_owwa_stats():
    return ok(owwa_reporting_service.build_owwa_stats())


@owwa_bp.get("/staff/owwa/analytics")
@jwt_required()
@role_required("staff", "admin")
def staff_owwa_analytics():
    months = int(request.args.get("months", 6))
    return ok(owwa_reporting_service.build_owwa_analytics(months))


def _parse_owwa_report_filters(args):
    return {
        "status": args.get("status") or None,
        "date_from": date.fromisoformat(args["date_from"]) if args.get("date_from") else None,
        "date_to": date.fromisoformat(args["date_to"]) if args.get("date_to") else None,
    }


@owwa_bp.get("/staff/owwa/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_owwa_excel():
    from services.pdf_service import OWWA_STAT_LABELS

    filters = _parse_owwa_report_filters(request.args)
    requests_ = owwa_reporting_service.query_owwa_requests_for_report(**filters)
    stats = owwa_reporting_service.build_owwa_stats()
    user = User.query.get(get_jwt_identity())
    date_str = datetime.utcnow().strftime("%B %d, %Y %I:%M %p UTC")

    summary_rows = [
        ["Generated:", date_str],
        ["Generated By:", f"{user.email} ({user.role})"],
        ["", ""],
        ["Metric", "Value"],
        *[[OWWA_STAT_LABELS.get(k, k), v] for k, v in stats.items()],
    ]
    request_rows = [
        [d["jobseeker_name"], d["email"], d["ofw_relationship"], d["status"], d["submitted_at"], d["verified_at"], d["submitted_to_owwa_at"], d["completed_at"], d["declined_reason"]]
        for d in (owwa_reporting_service.owwa_report_row(r) for r in requests_)
    ]

    buf = build_multi_sheet_excel_report([
        ("Summary", ["PESO Pila, Laguna — OWWA Assistance Program Report", ""], summary_rows),
        ("Requests", ["Applicant", "Email", "OFW Status / Relationship", "Status", "Submitted", "Verified", "Submitted to OWWA", "Completed", "Declined Reason"], request_rows),
    ])
    log_audit(user, "Export", "owwa_report", details="excel")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name="owwa_assistance_report.xlsx",
    )


@owwa_bp.get("/staff/owwa/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_owwa_pdf():
    filters = _parse_owwa_report_filters(request.args)
    requests_ = owwa_reporting_service.query_owwa_requests_for_report(**filters)
    stats = owwa_reporting_service.build_owwa_stats()
    user = User.query.get(get_jwt_identity())
    date_str = datetime.utcnow().strftime("%B %d, %Y %I:%M %p UTC")

    request_rows = [owwa_reporting_service.owwa_report_row(r) for r in requests_]
    pdf_bytes = generate_owwa_report(stats, request_rows, date_str, user.email, user.role)
    log_audit(user, "Export", "owwa_report", details="pdf")
    return send_file(
        to_bytesio(pdf_bytes), mimetype="application/pdf",
        as_attachment=True, download_name="owwa_assistance_report.pdf",
    )
