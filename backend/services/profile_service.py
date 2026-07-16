"""Shared JobseekerProfile mutation logic.

Used by both the jobseeker's own self-service routes (backend/blueprints/profile.py)
and the staff/admin on-behalf-of edit routes (backend/blueprints/staff.py), so both
entry points apply identical validation/behavior. Callers are responsible for
committing the session and calling log_audit() themselves — audit attribution differs
per caller (the jobseeker themselves vs. the acting staff user), so it can't be baked
into these shared functions.
"""

from extensions import db
from models.jobseeker import DOCUMENT_TYPES, Education, JobseekerDocument, WorkExperience
from services.storage_service import upload_file, validate_upload_file

SINGLE_INSTANCE_DOCUMENT_TYPES = tuple(t for t in DOCUMENT_TYPES if t != "training_certificate")

PROFILE_SCALAR_FIELDS = (
    "full_name", "contact_number", "date_of_birth", "gender", "civil_status", "nationality",
    "barangay", "municipality", "province", "region_code", "region_name", "zip_code",
    "employment_status", "preferred_job_position",
    "preferred_industry", "preferred_work_location", "expected_salary", "employment_type",
    "technical_skills", "soft_skills", "languages_spoken", "certifications",
)


def apply_profile_update(profile, data: dict) -> None:
    """Applies a validated (ProfileUpdateSchema) partial-update dict to a profile.
    Mutates the session but does not commit — the caller commits and audit-logs.
    """
    for field in PROFILE_SCALAR_FIELDS:
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


def apply_document_upload(profile, file, document_type: str) -> str | None:
    """Validates and uploads a document, mutating the session (no commit).
    Returns an error message string if invalid, else None.
    """
    if document_type not in DOCUMENT_TYPES:
        return "Invalid document type."

    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return error

    file_url = upload_file(
        file_bytes, file.filename, folder=f"documents/{profile.user_id}/{document_type}", content_type=file.mimetype
    )
    if document_type in SINGLE_INSTANCE_DOCUMENT_TYPES:
        JobseekerDocument.query.filter_by(profile_id=profile.id, document_type=document_type).delete()

    db.session.add(JobseekerDocument(
        profile_id=profile.id, document_type=document_type, file_url=file_url, original_filename=file.filename,
    ))
    return None


def find_document(profile, document_id: str) -> JobseekerDocument | None:
    return JobseekerDocument.query.filter_by(id=document_id, profile_id=profile.id).first()
