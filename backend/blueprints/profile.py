from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from extensions import db
from models.jobseeker import JobseekerProfile
from models.user import User
from schemas.jobseeker_schemas import ProfileUpdateSchema
from services.audit_service import log_audit
from services.gemini_resume_service import extract_resume, validate_resume_file
from services.pdf_service import generate_profile_report, generate_table_report, to_bytesio
from services.profile_service import apply_document_upload, apply_profile_update, find_document
from services.storage_service import upload_file, validate_upload_file
from utils.decorators import role_required
from utils.responses import fail, ok

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

OCR_MESSAGES = {
    "real": "Resume processed. Review the extracted fields below, then save your profile.",
    "error": "Resume uploaded, but we couldn't automatically read this document. Please fill in your details manually.",
}


def _get_profile() -> JobseekerProfile:
    user_id = get_jwt_identity()
    return JobseekerProfile.query.filter_by(user_id=user_id).first()


@profile_bp.get("")
@jwt_required()
@role_required("jobseeker")
def get_profile():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)
    user = User.query.get(profile.user_id)
    return ok(profile.to_dict(include_email=user.email if user else None))


@profile_bp.put("")
@jwt_required()
@role_required("jobseeker")
def update_profile():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)

    try:
        data = ProfileUpdateSchema().load(request.get_json(force=True) or {}, partial=True)
    except ValidationError as err:
        return fail("Invalid profile data", 400, err.messages)

    apply_profile_update(profile, data)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id)

    from services.lmi_service import LMI_RELEVANT_PROFILE_FIELDS, notify_lmi_update

    if any(f in data for f in LMI_RELEVANT_PROFILE_FIELDS):
        notify_lmi_update("jobseeker_profile_updated")

    return ok(profile.to_dict(), "Profile updated.")


@profile_bp.post("/picture")
@jwt_required()
@role_required("jobseeker")
def upload_picture():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    profile.profile_picture_url = upload_file(
        file_bytes, file.filename, folder=f"profile-pictures/{profile.user_id}", content_type=file.mimetype
    )
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, "Profile picture uploaded")
    return ok(profile.to_dict(), "Profile picture updated.")


@profile_bp.post("/documents")
@jwt_required()
@role_required("jobseeker")
def upload_document():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    document_type = request.form.get("document_type")
    error = apply_document_upload(profile, request.files["file"], document_type)
    if error:
        return fail(error, 400)

    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, f"Document uploaded: {document_type}")
    return ok(profile.to_dict(), "Document uploaded.")


@profile_bp.delete("/documents/<document_id>")
@jwt_required()
@role_required("jobseeker")
def delete_document(document_id):
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)

    document = find_document(profile, document_id)
    if not document:
        return fail("Document not found.", 404)

    document_type = document.document_type
    db.session.delete(document)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, f"Document removed: {document_type}")
    return ok(profile.to_dict(), "Document removed.")


@profile_bp.post("/resume")
@jwt_required()
@role_required("jobseeker")
def upload_resume():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)
    if "file" not in request.files:
        return fail("No file uploaded.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_resume_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    profile_id, user_id = profile.id, profile.user_id
    # Release the DB connection before the slow, blocking Storage upload + Gemini
    # extraction call. Otherwise it sits idle-in-transaction for that whole time,
    # needlessly holding one of Supabase's limited pooler connections and making
    # exhaustion far more likely under any concurrent load. The session is reopened
    # automatically on next use.
    db.session.close()

    # Uploaded first and unconditionally — the file itself is never lost regardless of
    # whether extraction below succeeds or errors out.
    resume_url = upload_file(file_bytes, file.filename, folder=f"resumes/{user_id}", content_type=file.mimetype)
    result = extract_resume(file_bytes, file.filename)
    extraction_mode = result["mode"]

    # Only resume_url is persisted here. The extracted personal/education/employment/
    # skills fields are returned to the frontend for local review and highlighting —
    # never written to the database, and never overwriting anything the user already
    # typed, until the user reviews them and clicks Save Changes (PUT /api/profile).
    profile = JobseekerProfile.query.get(profile_id)
    profile.resume_url = resume_url
    db.session.commit()
    log_audit(
        User.query.get(profile.user_id), "Update", "profile", profile.id,
        f"Resume uploaded, extraction mode={extraction_mode}",
    )

    return ok(
        {
            "resume_url": resume_url,
            "extracted": result["extracted"],
            "extracted_at": f"{datetime.utcnow().isoformat()}Z" if extraction_mode == "real" else None,
            "ocr_status": extraction_mode,
            "ocr_detail": result["detail"],
        },
        OCR_MESSAGES[extraction_mode],
    )


@profile_bp.get("/resume-pdf")
@jwt_required()
@role_required("jobseeker")
def download_resume_pdf():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)

    rows = [[e.company, e.position, f"{e.start_date or ''} - {e.end_date or 'present'}"] for e in profile.work_experiences]
    rows += [[e.school, e.degree or "", str(e.graduation_year or "")] for e in profile.educations]
    pdf_bytes = generate_table_report(
        f"Resume — {profile.full_name}",
        ["Company/School", "Position/Degree", "Duration/Year"],
        rows,
        datetime.utcnow().strftime("%Y-%m-%d"),
    )
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="resume.pdf")


@profile_bp.get("/application-pdf")
@jwt_required()
@role_required("jobseeker")
def download_application_pdf():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)

    user = User.query.get(profile.user_id)
    profile_data = profile.to_dict(include_email=user.email if user else None)
    pdf_bytes = generate_profile_report(profile_data, profile_data["documents"])
    return send_file(
        to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="jobbridge-profile.pdf"
    )
