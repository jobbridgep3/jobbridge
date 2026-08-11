"""Manpower Skills Training Referral module — jobseekers apply/express interest, staff pools
them offline into batches (min. 15 pax), formalizes a project proposal, and submits it to
TESDA. Routed under /api/training-referral/... (jobseeker) and /api/staff/training-referral/...
(staff + admin, admin reuses the same read/list routes read-only from the frontend side,
matching the DILP/OWWA/SPES precedent in blueprints/programs.py).

Distinct from blueprints/training.py (the pre-existing enrollment/QR-attendance/certificate
"Manpower Skills Training" module) — this module only tracks the referral pipeline up to
TESDA's response and does not touch training.py's tables, routes, or UI."""

from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.jobseeker import JobseekerProfile
from models.manpower_training import ManpowerTrainingApplication, ManpowerTrainingBatch
from models.user import User
from services.audit_service import log_audit
from services.email_service import (
    send_manpower_referral_awaiting_response_email,
    send_manpower_referral_completed_email,
    send_manpower_referral_declined_email,
    send_manpower_referral_received_email,
    send_manpower_referral_submitted_email,
)
from services.notification_service import notify_role, notify_user
from utils.decorators import role_required
from utils.responses import fail, ok


def _notify_application(application: ManpowerTrainingApplication, title: str, message: str):
    notify_user(
        application.jobseeker_profile.user_id, "training_referral_status", title, message,
        link="/jobseeker/training-referral",
        socket_event="training_referral:status_change",
        socket_payload={"application_id": str(application.id), "new_status": application.status},
    )


def _notify_board(kind: str, record_id):
    """Pings staff + admin that an application/batch changed, so their queue/batch/oversight
    views can live-refetch from the REST endpoints (payload carries no PII — just enough to
    know something changed)."""
    payload = {"type": kind, "id": str(record_id)}
    notify_role("staff", "training_referral:board_update", payload)
    notify_role("admin", "training_referral:board_update", payload)

manpower_training_bp = Blueprint("manpower_training", __name__, url_prefix="/api")


# ---------- Jobseeker ----------

@manpower_training_bp.get("/training-referral/my")
@jwt_required()
@role_required("jobseeker")
def my_manpower_applications():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    apps = ManpowerTrainingApplication.query.filter_by(jobseeker_profile_id=profile.id).order_by(
        ManpowerTrainingApplication.created_at.desc()
    ).all()
    return ok([a.to_dict() for a in apps])


@manpower_training_bp.post("/training-referral/apply")
@jwt_required()
@role_required("jobseeker")
def apply_manpower_training():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)

    data = request.get_json(force=True) or {}
    program_interest = (data.get("program_interest") or "").strip()
    if not program_interest:
        return fail("Program/skill interest is required.", 400)

    application = ManpowerTrainingApplication(
        jobseeker_profile_id=profile.id,
        program_interest=program_interest,
        remarks=data.get("notes"),
        status="pending",
        application_date=datetime.utcnow(),
    )
    db.session.add(application)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "training_referral", application.id)

    send_manpower_referral_received_email(
        profile.user.email, profile.full_name, program_interest, application.application_date.strftime("%B %d, %Y"),
    )
    _notify_application(application, "Manpower Skills Training application received", "Your application is under review by PESO staff.")
    _notify_board("application", application.id)

    return ok(application.to_dict(), "Manpower Skills Training application submitted.", 201)


@manpower_training_bp.put("/training-referral/<application_id>/withdraw")
@jwt_required()
@role_required("jobseeker")
def withdraw_manpower_application(application_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    application = ManpowerTrainingApplication.query.get(application_id)
    if not application or not profile or application.jobseeker_profile_id != profile.id:
        return fail("Application not found.", 404)
    if application.status not in ("pending", "pooled"):
        return fail("This application can no longer be withdrawn.", 400)

    application.status = "declined"
    application.remarks = "Withdrawn by applicant."
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Withdraw", "training_referral", application.id)
    _notify_board("application", application.id)
    return ok(application.to_dict(), "Application withdrawn.")


# ---------- Staff (+ admin, read-only from the frontend) ----------

@manpower_training_bp.get("/staff/training-referral/queue")
@jwt_required()
@role_required("staff", "admin")
def staff_manpower_queue():
    query = ManpowerTrainingApplication.query
    status = request.args.get("status", "pending")
    if status:
        query = query.filter_by(status=status)
    apps = query.order_by(ManpowerTrainingApplication.created_at.asc()).all()
    return ok([a.to_dict() for a in apps])


@manpower_training_bp.get("/staff/training-referral/applications")
@jwt_required()
@role_required("staff", "admin")
def staff_manpower_applications_all():
    """All applications, unfiltered by default — backs the admin oversight dashboard."""
    query = ManpowerTrainingApplication.query
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    if request.args.get("batch_id"):
        query = query.filter_by(batch_id=request.args["batch_id"])
    apps = query.order_by(ManpowerTrainingApplication.created_at.desc()).all()
    return ok([a.to_dict() for a in apps])


@manpower_training_bp.post("/staff/training-referral/applications/<application_id>/decline")
@jwt_required()
@role_required("staff", "admin")
def staff_decline_manpower_application(application_id):
    application = ManpowerTrainingApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    remarks = (data.get("remarks") or "").strip()
    if not remarks:
        return fail("A reason is required to decline this applicant.", 400)

    application.status = "declined"
    application.remarks = remarks
    application.staff_id = get_jwt_identity()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Decline", "training_referral", application.id)

    batch_name = application.batch.batch_name if application.batch else None
    send_manpower_referral_declined_email(application.jobseeker_profile.user.email, application.jobseeker_profile.full_name, batch_name, remarks)
    _notify_application(application, "Manpower Skills Training application declined", remarks)
    _notify_board("application", application.id)

    return ok(application.to_dict(), "Applicant declined.")


@manpower_training_bp.get("/staff/training-referral/batches")
@jwt_required()
@role_required("staff", "admin")
def staff_list_manpower_batches():
    query = ManpowerTrainingBatch.query
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    batches = query.order_by(ManpowerTrainingBatch.created_at.desc()).all()
    return ok([b.to_dict() for b in batches])


@manpower_training_bp.post("/staff/training-referral/batches")
@jwt_required()
@role_required("staff", "admin")
def staff_create_manpower_batch():
    data = request.get_json(force=True) or {}
    batch_name = (data.get("batch_name") or "").strip()
    if not batch_name:
        return fail("Batch name is required.", 400)

    batch = ManpowerTrainingBatch(batch_name=batch_name, min_pax=data.get("min_pax") or 15)
    db.session.add(batch)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "training_referral_batch", batch.id)
    _notify_board("batch", batch.id)
    return ok(batch.to_dict(), "Batch created.", 201)


@manpower_training_bp.get("/staff/training-referral/batches/<batch_id>")
@jwt_required()
@role_required("staff", "admin")
def staff_manpower_batch_detail(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    applications = ManpowerTrainingApplication.query.filter_by(batch_id=batch.id).order_by(
        ManpowerTrainingApplication.created_at.asc()
    ).all()
    payload = batch.to_dict()
    payload["applications"] = [a.to_dict() for a in applications]
    return ok(payload)


@manpower_training_bp.post("/staff/training-referral/batches/<batch_id>/pool")
@jwt_required()
@role_required("staff", "admin")
def staff_pool_into_batch(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status != "forming":
        return fail("This batch is no longer accepting applicants.", 400)

    data = request.get_json(force=True) or {}
    application_ids = data.get("application_ids") or []
    if not application_ids:
        return fail("Select at least one applicant to pool.", 400)

    applications = ManpowerTrainingApplication.query.filter(
        ManpowerTrainingApplication.id.in_(application_ids),
        ManpowerTrainingApplication.status == "pending",
    ).all()
    for application in applications:
        application.batch_id = batch.id
        application.status = "pooled"
        application.staff_id = get_jwt_identity()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Pool", "training_referral_batch", batch.id, details=f"{len(applications)} applicant(s) pooled")
    _notify_board("batch", batch.id)
    return ok(batch.to_dict(), f"{len(applications)} applicant(s) added to {batch.batch_name}.")


@manpower_training_bp.post("/staff/training-referral/batches/<batch_id>/upload-proposal")
@jwt_required()
@role_required("staff", "admin")
def staff_upload_manpower_proposal(batch_id):
    from services.storage_service import upload_file, validate_upload_file

    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    # Release the DB connection before the slow, blocking Storage upload call —
    # see the identical comment in blueprints/programs.py's upload_program_docs.
    db.session.close()

    url = upload_file(file_bytes, file.filename, folder=f"training-referral-proposals/{batch_id}", content_type=file.mimetype)

    batch = ManpowerTrainingBatch.query.get(batch_id)
    batch.project_proposal_url = url
    db.session.commit()
    _notify_board("batch", batch.id)
    return ok(batch.to_dict(), "Project proposal uploaded.")


def _cascade_batch_status(batch: ManpowerTrainingBatch, new_status: str, remarks: str | None = None):
    """Updates the batch + every still-pooled (non-individually-declined) linked application
    to new_status in a single transaction, so a failure can't leave batch/applications split
    across two different statuses. Returns the applications that were cascaded, for
    post-commit email/notification fan-out."""
    batch.status = new_status
    affected = []
    for application in batch.applications:
        if application.status == "declined":
            continue
        application.status = new_status
        if remarks:
            application.remarks = remarks
        affected.append(application)
    return affected


def _email_batch_cascade(applications, new_status: str, batch_name: str, submitted_date_str: str | None = None, remarks: str | None = None):
    for application in applications:
        profile = application.jobseeker_profile
        if new_status == "submitted_to_tesda":
            send_manpower_referral_submitted_email(profile.user.email, profile.full_name, batch_name, submitted_date_str)
        elif new_status == "for_tesda_response":
            send_manpower_referral_awaiting_response_email(profile.user.email, profile.full_name, batch_name)
        elif new_status == "completed":
            send_manpower_referral_completed_email(profile.user.email, profile.full_name, batch_name)
        elif new_status == "declined":
            send_manpower_referral_declined_email(profile.user.email, profile.full_name, batch_name, remarks)
        _notify_application(application, f"Manpower Skills Training — {batch_name}", remarks or f"Status updated to {new_status.replace('_', ' ')}.")


@manpower_training_bp.put("/staff/training-referral/batches/<batch_id>/submit-to-tesda")
@jwt_required()
@role_required("staff", "admin")
def staff_submit_batch_to_tesda(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status != "forming":
        return fail("This batch has already been submitted.", 400)
    pooled_count = len([a for a in batch.applications if a.status != "declined"])
    if pooled_count < batch.min_pax:
        return fail(f"At least {batch.min_pax} pooled applicants are required (currently {pooled_count}).", 400)
    if not batch.project_proposal_url:
        return fail("Upload the project proposal document before submitting to TESDA.", 400)

    batch.submitted_to_tesda_date = datetime.utcnow()
    affected = _cascade_batch_status(batch, "submitted_to_tesda")
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Submit to TESDA", "training_referral_batch", batch.id)

    _email_batch_cascade(affected, "submitted_to_tesda", batch.batch_name, submitted_date_str=batch.submitted_to_tesda_date.strftime("%B %d, %Y"))
    _notify_board("batch", batch.id)

    return ok(batch.to_dict(), "Batch submitted to TESDA.")


@manpower_training_bp.put("/staff/training-referral/batches/<batch_id>/follow-up")
@jwt_required()
@role_required("staff", "admin")
def staff_follow_up_batch(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status != "submitted_to_tesda":
        return fail("Only batches already submitted to TESDA can be marked for follow-up.", 400)

    affected = _cascade_batch_status(batch, "for_tesda_response")
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Follow Up", "training_referral_batch", batch.id)

    _email_batch_cascade(affected, "for_tesda_response", batch.batch_name)
    _notify_board("batch", batch.id)

    return ok(batch.to_dict(), "Batch marked as awaiting TESDA response.")


@manpower_training_bp.put("/staff/training-referral/batches/<batch_id>/complete")
@jwt_required()
@role_required("staff", "admin")
def staff_complete_batch(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status not in ("submitted_to_tesda", "for_tesda_response"):
        return fail("Only batches submitted to TESDA can be marked completed.", 400)

    batch.tesda_response_date = datetime.utcnow()
    affected = _cascade_batch_status(batch, "completed")
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Mark Completed", "training_referral_batch", batch.id)

    _email_batch_cascade(affected, "completed", batch.batch_name)
    _notify_board("batch", batch.id)

    return ok(batch.to_dict(), "Batch marked completed — training confirmed.")


@manpower_training_bp.put("/staff/training-referral/batches/<batch_id>/decline")
@jwt_required()
@role_required("staff", "admin")
def staff_decline_batch(batch_id):
    batch = ManpowerTrainingBatch.query.get(batch_id)
    if not batch:
        return fail("Batch not found.", 404)
    if batch.status not in ("submitted_to_tesda", "for_tesda_response"):
        return fail("Only batches submitted to TESDA can be marked declined.", 400)

    data = request.get_json(force=True) or {}
    remarks = (data.get("remarks") or "").strip()
    if not remarks:
        return fail("A reason is required to decline this batch.", 400)

    batch.tesda_response_date = datetime.utcnow()
    affected = _cascade_batch_status(batch, "declined", remarks=remarks)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Mark Declined", "training_referral_batch", batch.id, details=remarks)

    _email_batch_cascade(affected, "declined", batch.batch_name, remarks=remarks)
    _notify_board("batch", batch.id)

    return ok(batch.to_dict(), "Batch marked declined.")
