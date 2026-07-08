"""SPES / DILP / OWWA share an identical application+review workflow, so one blueprint
serves all three under /api/<program>/... and /api/staff/<program>/..., matching the
exact endpoint paths documented per module in the spec."""

from datetime import date, datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.jobseeker import JobseekerProfile
from models.program import ProgramApplication
from models.user import User
from services.audit_service import log_audit
from services.excel_service import build_excel_report
from services.notification_service import notify_user
from utils.decorators import role_required
from utils.responses import fail, ok

programs_bp = Blueprint("programs", __name__, url_prefix="/api")

VALID_PROGRAMS = ("spes", "dilp", "owwa")


def _check_program(program_type):
    if program_type not in VALID_PROGRAMS:
        return fail("Unknown program.", 404)
    return None


@programs_bp.get("/<program_type>/my")
@jwt_required()
@role_required("jobseeker")
def my_program_applications(program_type):
    err = _check_program(program_type)
    if err:
        return err
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    apps = ProgramApplication.query.filter_by(program_type=program_type, jobseeker_profile_id=profile.id).order_by(
        ProgramApplication.created_at.desc()
    ).all()
    return ok([a.to_dict() for a in apps])


@programs_bp.post("/<program_type>/apply")
@jwt_required()
@role_required("jobseeker")
def apply_program(program_type):
    err = _check_program(program_type)
    if err:
        return err
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)

    data = request.get_json(force=True) or {}
    application = ProgramApplication(
        program_type=program_type, jobseeker_profile_id=profile.id,
        form_data=data.get("form_data", data), status="submitted",
    )
    db.session.add(application)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", program_type, application.id)
    return ok(application.to_dict(), f"{program_type.upper()} application submitted.", 201)


@programs_bp.post("/<program_type>/upload-docs")
@jwt_required()
@role_required("jobseeker")
def upload_program_docs(program_type):
    err = _check_program(program_type)
    if err:
        return err
    from services.ocr_service import extract_text_from_resume
    from services.storage_service import upload_file, validate_upload_file

    data = request.form
    application = ProgramApplication.query.get(data.get("application_id"))
    if not application:
        return fail("Application not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    application_id, profile_id = application.id, application.jobseeker_profile_id
    # Release the DB connection before the slow, blocking Storage upload + Vision OCR
    # calls — see the identical comment in blueprints/profile.py's upload_resume for why
    # holding it open here contributed to exhausting Supabase's pooler connection limit.
    db.session.close()

    url = upload_file(file_bytes, file.filename, folder=f"{program_type}-docs/{profile_id}", content_type=file.mimetype)
    result = extract_text_from_resume(file_bytes, file.filename)
    ocr_text = result["text"] or "" if result["mode"] == "real" else ""

    application = ProgramApplication.query.get(application_id)
    docs = list(application.document_urls or [])
    docs.append({"url": url, "filename": file.filename, "ocr_text": ocr_text[:2000], "ocr_status": result["mode"]})
    application.document_urls = docs
    db.session.commit()
    return ok(application.to_dict(), "Document uploaded.")


# ---------- Staff management ----------

@programs_bp.get("/staff/<program_type>")
@jwt_required()
@role_required("staff", "admin")
def staff_list_program(program_type):
    err = _check_program(program_type)
    if err:
        return err
    query = ProgramApplication.query.filter_by(program_type=program_type)
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    apps = query.order_by(ProgramApplication.created_at.desc()).all()
    return ok([a.to_dict() for a in apps])


@programs_bp.put("/staff/<program_type>/<application_id>/approve")
@jwt_required()
@role_required("staff", "admin")
def approve_program(program_type, application_id):
    err = _check_program(program_type)
    if err:
        return err
    application = ProgramApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)

    data = request.get_json(force=True) or {}
    application.status = {"spes": "endorsed", "dilp": "for_release", "owwa": "endorsed"}[program_type]
    application.remarks = data.get("remarks")
    application.reviewed_by = get_jwt_identity()
    application.reviewed_at = datetime.utcnow()
    if data.get("release_date"):
        application.release_date = date.fromisoformat(data["release_date"])
    if data.get("release_amount") is not None:
        application.release_amount = data["release_amount"]
    db.session.commit()

    notify_user(
        application.jobseeker_profile.user_id, "program_status", f"{program_type.upper()} application approved",
        application.remarks or "Your application has been approved.", link=f"/jobseeker/{program_type}",
        socket_event="program:status_change",
        socket_payload={"type": program_type, "application_id": str(application.id), "new_status": application.status},
    )
    log_audit(User.query.get(get_jwt_identity()), "Approve", program_type, application.id)
    return ok(application.to_dict(), "Application approved.")


@programs_bp.put("/staff/<program_type>/<application_id>/reject")
@jwt_required()
@role_required("staff", "admin")
def reject_program(program_type, application_id):
    err = _check_program(program_type)
    if err:
        return err
    application = ProgramApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    application.status = "rejected"
    application.remarks = data.get("remarks", "")
    application.reviewed_by = get_jwt_identity()
    application.reviewed_at = datetime.utcnow()
    db.session.commit()

    notify_user(
        application.jobseeker_profile.user_id, "program_status", f"{program_type.upper()} application rejected",
        application.remarks, link=f"/jobseeker/{program_type}",
        socket_event="program:status_change",
        socket_payload={"type": program_type, "application_id": str(application.id), "new_status": "rejected"},
    )
    log_audit(User.query.get(get_jwt_identity()), "Reject", program_type, application.id)
    return ok(application.to_dict(), "Application rejected.")


@programs_bp.put("/staff/<program_type>/<application_id>/request-docs")
@jwt_required()
@role_required("staff", "admin")
def request_more_docs(program_type, application_id):
    application = ProgramApplication.query.get(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    application.remarks = data.get("remarks", "Additional documents required.")
    db.session.commit()
    notify_user(
        application.jobseeker_profile.user_id, "program_status", "Additional documents requested",
        application.remarks, link=f"/jobseeker/{program_type}",
        socket_event="program:status_change",
        socket_payload={"type": program_type, "application_id": str(application.id), "new_status": application.status},
    )
    return ok(application.to_dict(), "Requested additional documents.")


@programs_bp.get("/staff/<program_type>/report")
@jwt_required()
@role_required("staff", "admin")
def program_report(program_type):
    err = _check_program(program_type)
    if err:
        return err
    apps = ProgramApplication.query.filter_by(program_type=program_type).all()
    rows = [[a.jobseeker_profile.full_name, a.status, str(a.created_at.date())] for a in apps]
    buf = build_excel_report(f"{program_type.upper()} Report", ["Jobseeker", "Status", "Date Submitted"], rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name=f"{program_type}_report.xlsx")
