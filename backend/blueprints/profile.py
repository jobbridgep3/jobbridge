import logging
from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from extensions import db
from models.jobseeker import Education, JobseekerProfile, WorkExperience
from models.user import User
from schemas.jobseeker_schemas import ProfileUpdateSchema
from services.audit_service import log_audit
from services.ocr_service import extract_text_from_resume
from services.resume_parsing import parse_resume_text
from services.resume_parsing.layout import reorder_blocks
from services.pdf_service import generate_profile_report, generate_table_report, to_bytesio
from services.profile_service import apply_document_upload, apply_profile_update, find_document
from services.storage_service import upload_file, validate_upload_file
from utils.decorators import role_required
from utils.responses import fail, ok

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

OCR_MESSAGES = {
    "real": "Resume processed and profile auto-filled from OCR.",
    "error": "Resume uploaded, but we couldn't automatically read this document. Please fill in your details manually.",
}


def _get_profile() -> JobseekerProfile:
    user_id = get_jwt_identity()
    return JobseekerProfile.query.filter_by(user_id=user_id).first()


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _is_duplicate_work_experience(profile: JobseekerProfile, candidate: dict) -> bool:
    return any(
        _norm(w.company) == _norm(candidate.get("company")) and _norm(w.position) == _norm(candidate.get("position"))
        for w in profile.work_experiences
    )


def _is_duplicate_education(profile: JobseekerProfile, candidate: dict) -> bool:
    return any(
        _norm(e.school) == _norm(candidate.get("school")) and _norm(e.degree) == _norm(candidate.get("degree"))
        for e in profile.educations
    )


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
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    profile_id, user_id = profile.id, profile.user_id
    # Release the DB connection before the slow, blocking Storage upload + Vision OCR
    # calls (which can take anywhere from a few seconds up to ~120s for a PDF retry).
    # Otherwise it sits idle-in-transaction for that whole time, needlessly holding one
    # of Supabase's limited pooler connections and making exhaustion far more likely
    # under any concurrent load. The session is reopened automatically on next use.
    db.session.close()

    # Uploaded first and unconditionally — the file itself is never lost regardless of
    # whether OCR extraction below succeeds or errors out.
    resume_url = upload_file(file_bytes, file.filename, folder=f"resumes/{user_id}", content_type=file.mimetype)
    result = extract_text_from_resume(file_bytes, file.filename)
    ocr_mode = result["mode"]

    parsed = {}
    if ocr_mode == "real":
        reordered = reorder_blocks(result["layout"])
        try:
            parsed = parse_resume_text(reordered)
        except Exception:  # noqa: BLE001
            # Field-mapping failing must never lose the already-uploaded file or the
            # raw OCR text below — the same "still counts as processed" outcome as a
            # resume with genuinely no confidently-extractable fields.
            logging.getLogger(__name__).exception("Resume field-mapping failed for %s", file.filename)
            parsed = {}

    profile = JobseekerProfile.query.get(profile_id)
    profile.resume_url = resume_url
    if ocr_mode == "real":
        profile.resume_raw_text = result["text"]
    # On "error": leave any prior resume_raw_text/parsed data untouched rather than
    # overwriting it with nothing.

    if parsed.get("full_name") and not profile.full_name:
        profile.full_name = parsed["full_name"]
    if parsed.get("contact_number") and not profile.contact_number:
        profile.contact_number = parsed["contact_number"]
    if parsed.get("date_of_birth") and not profile.date_of_birth:
        profile.date_of_birth = parsed["date_of_birth"]
    address = parsed.get("address")
    if address and not (profile.barangay or profile.municipality or profile.province):
        profile.barangay = address.get("barangay")
        profile.municipality = address.get("municipality")
        profile.province = address.get("province")
    if parsed.get("technical_skills"):
        profile.technical_skills = sorted(set(profile.technical_skills or []) | set(parsed["technical_skills"]))
    if parsed.get("soft_skills"):
        profile.soft_skills = sorted(set(profile.soft_skills or []) | set(parsed["soft_skills"]))
    if parsed.get("languages_spoken"):
        profile.languages_spoken = sorted(set(profile.languages_spoken or []) | set(parsed["languages_spoken"]))
    if parsed.get("certifications"):
        profile.certifications = sorted(set(profile.certifications or []) | set(parsed["certifications"]))
    for entry in parsed.get("work_experiences", [])[:10]:
        if not _is_duplicate_work_experience(profile, entry):
            db.session.add(WorkExperience(profile_id=profile.id, **entry))
    for entry in parsed.get("educations", [])[:10]:
        if not _is_duplicate_education(profile, entry):
            db.session.add(Education(profile_id=profile.id, **entry))
    # parsed["email"] is intentionally never written to the profile or User.email —
    # resume content shouldn't silently change a verified account's login identity. It's
    # surfaced below as read-only, informational-only data the user can apply themselves.

    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, f"Resume uploaded, OCR mode={ocr_mode}")

    response_data = profile.to_dict()
    response_data["ocr_status"] = ocr_mode
    response_data["ocr_detail"] = result["detail"] if ocr_mode == "error" else None
    response_data["ocr_extracted_email"] = parsed.get("email")
    return ok(response_data, OCR_MESSAGES[ocr_mode])


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
