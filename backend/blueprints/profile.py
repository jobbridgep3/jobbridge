from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from marshmallow import ValidationError

from extensions import db
from models.jobseeker import DOCUMENT_TYPES, Education, JobseekerDocument, JobseekerProfile, WorkExperience
from models.user import User
from schemas.jobseeker_schemas import ProfileUpdateSchema
from services.audit_service import log_audit
from services.nlp_service import parse_resume_text
from services.ocr_service import extract_text_from_resume
from services.pdf_service import generate_profile_report, generate_table_report, to_bytesio
from services.storage_service import upload_file, validate_upload_file
from utils.decorators import role_required
from utils.responses import fail, ok

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

SINGLE_INSTANCE_DOCUMENT_TYPES = tuple(t for t in DOCUMENT_TYPES if t != "training_certificate")

OCR_MESSAGES = {
    "real": "Resume processed and profile auto-filled from OCR.",
    "mock": "Resume uploaded. OCR is not configured in this environment, so preview data was used — please fill in your details manually.",
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

    scalar_fields = (
        "full_name", "contact_number", "date_of_birth", "gender", "civil_status", "nationality",
        "barangay", "municipality", "province", "employment_status", "preferred_job_position",
        "preferred_industry", "preferred_work_location", "expected_salary", "employment_type",
        "technical_skills", "soft_skills", "languages_spoken", "certifications",
    )
    for field in scalar_fields:
        if field in data:
            setattr(profile, field, data[field])

    if any(f in data for f in ("barangay", "municipality", "province")):
        profile.address = ", ".join(filter(None, [profile.barangay, profile.municipality, profile.province])) or profile.address

    if "work_experiences" in data:
        WorkExperience.query.filter_by(profile_id=profile.id).delete()
        for we in data["work_experiences"]:
            db.session.add(WorkExperience(
                profile_id=profile.id,
                company=we.get("company", ""),
                position=we.get("position", ""),
                start_date=we.get("start_date"),
                end_date=we.get("end_date"),
                description=we.get("description"),
            ))

    if "educations" in data:
        Education.query.filter_by(profile_id=profile.id).delete()
        for ed in data["educations"]:
            db.session.add(Education(
                profile_id=profile.id,
                school=ed.get("school", ""),
                degree=ed.get("degree"),
                graduation_year=ed.get("graduation_year"),
                attainment_level=ed.get("attainment_level"),
                honors=ed.get("honors"),
            ))

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
    if document_type not in DOCUMENT_TYPES:
        return fail("Invalid document type.", 400)

    file = request.files["file"]
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    file_url = upload_file(
        file_bytes, file.filename, folder=f"documents/{profile.user_id}/{document_type}", content_type=file.mimetype
    )

    if document_type in SINGLE_INSTANCE_DOCUMENT_TYPES:
        JobseekerDocument.query.filter_by(profile_id=profile.id, document_type=document_type).delete()

    db.session.add(JobseekerDocument(
        profile_id=profile.id, document_type=document_type, file_url=file_url, original_filename=file.filename,
    ))
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

    document = JobseekerDocument.query.filter_by(id=document_id, profile_id=profile.id).first()
    if not document:
        return fail("Document not found.", 404)

    db.session.delete(document)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, f"Document removed: {document.document_type}")
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

    # Uploaded first and unconditionally — the file itself is never lost regardless of
    # whether OCR extraction below succeeds, is mocked, or errors out.
    resume_url = upload_file(file_bytes, file.filename, folder=f"resumes/{profile.user_id}", content_type=file.mimetype)
    profile.resume_url = resume_url

    result = extract_text_from_resume(file_bytes, file.filename)
    ocr_mode = result["mode"]

    parsed = {}
    if ocr_mode in ("real", "mock"):
        profile.resume_raw_text = result["text"]
        parsed = parse_resume_text(result["text"])
    # On "error": leave any prior resume_raw_text/parsed data untouched rather than
    # overwriting it with nothing or with fabricated mock content.

    if parsed.get("full_name") and not profile.full_name:
        profile.full_name = parsed["full_name"]
    if parsed.get("contact_number") and not profile.contact_number:
        profile.contact_number = parsed["contact_number"]
    if parsed.get("skills"):
        profile.technical_skills = sorted(set(profile.technical_skills or []) | set(parsed["skills"]))
    for line in parsed.get("work_experience_lines", [])[:5]:
        db.session.add(WorkExperience(profile_id=profile.id, company="", position=line[:255]))
    for line in parsed.get("education_lines", [])[:5]:
        db.session.add(Education(profile_id=profile.id, school=line[:255]))
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
