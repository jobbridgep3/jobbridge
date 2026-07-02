from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.jobseeker import Education, JobseekerProfile, WorkExperience
from models.user import User
from services.audit_service import log_audit
from services.nlp_service import parse_resume_text
from services.ocr_service import extract_text_from_resume
from services.pdf_service import generate_table_report, to_bytesio
from services.storage_service import upload_file
from utils.decorators import role_required
from utils.responses import fail, ok

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


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

    data = request.get_json(force=True) or {}
    for field in ("full_name", "contact_number", "address"):
        if field in data:
            setattr(profile, field, data[field])
    if "date_of_birth" in data and data["date_of_birth"]:
        profile.date_of_birth = datetime.fromisoformat(data["date_of_birth"]).date()
    if "skills" in data:
        profile.skills = data["skills"]

    if "work_experiences" in data:
        WorkExperience.query.filter_by(profile_id=profile.id).delete()
        for we in data["work_experiences"]:
            db.session.add(WorkExperience(
                profile_id=profile.id,
                company=we.get("company", ""),
                position=we.get("position", ""),
                start_date=datetime.fromisoformat(we["start_date"]).date() if we.get("start_date") else None,
                end_date=datetime.fromisoformat(we["end_date"]).date() if we.get("end_date") else None,
                description=we.get("description"),
            ))

    if "educations" in data:
        Education.query.filter_by(profile_id=profile.id).delete()
        for ed in data["educations"]:
            db.session.add(Education(
                profile_id=profile.id,
                school=ed.get("school", ""),
                degree=ed.get("degree", ""),
                graduation_year=ed.get("graduation_year"),
            ))

    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id)
    return ok(profile.to_dict(), "Profile updated.")


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

    resume_url = upload_file(file_bytes, file.filename, folder=f"resumes/{profile.user_id}", content_type=file.mimetype)
    profile.resume_url = resume_url

    raw_text = extract_text_from_resume(file_bytes, file.filename)
    profile.resume_raw_text = raw_text
    parsed = parse_resume_text(raw_text)

    if parsed.get("full_name") and not profile.full_name:
        profile.full_name = parsed["full_name"]
    if parsed.get("contact_number") and not profile.contact_number:
        profile.contact_number = parsed["contact_number"]
    if parsed.get("skills"):
        profile.skills = sorted(set((profile.skills or [])) | set(parsed["skills"]))

    for line in parsed.get("work_experience_lines", [])[:5]:
        db.session.add(WorkExperience(profile_id=profile.id, company="", position=line[:255]))
    for line in parsed.get("education_lines", [])[:5]:
        db.session.add(Education(profile_id=profile.id, school=line[:255], degree=""))

    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "profile", profile.id, "Resume uploaded & OCR-parsed")

    return ok(profile.to_dict(), "Resume processed and profile auto-filled.")


@profile_bp.get("/resume-pdf")
@jwt_required()
@role_required("jobseeker")
def download_resume_pdf():
    profile = _get_profile()
    if not profile:
        return fail("Profile not found.", 404)

    rows = [[e.company, e.position, f"{e.start_date or ''} - {e.end_date or 'present'}"] for e in profile.work_experiences]
    rows += [[e.school, e.degree, str(e.graduation_year or "")] for e in profile.educations]
    pdf_bytes = generate_table_report(
        f"Resume — {profile.full_name}",
        ["Company/School", "Position/Degree", "Duration/Year"],
        rows,
        datetime.utcnow().strftime("%Y-%m-%d"),
    )
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="resume.pdf")
