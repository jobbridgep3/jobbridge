from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

DOCUMENT_TYPES = ("government_id", "id_photo_2x2", "diploma", "training_certificate", "certificate_of_employment")
REQUIRED_DOCUMENT_TYPES = ("government_id",)  # Resume/CV is tracked separately via resume_url
DOCUMENT_TYPE_LABELS = {
    "government_id": "Valid Government ID",
    "id_photo_2x2": "2x2 ID Picture",
    "diploma": "Diploma",
    "training_certificate": "Training Certificate",
    "certificate_of_employment": "Certificate of Employment",
}


class JobseekerProfile(BaseModel):
    __tablename__ = "jobseeker_profiles"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False, default="")
    contact_number = db.Column(db.String(30), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    skills = db.Column(db.JSON, default=list)  # DEPRECATED — superseded by technical_skills/soft_skills below;
    # retained + data-migrated for backward compatibility, no longer written by new code.
    resume_url = db.Column(db.String(1000), nullable=True)
    resume_raw_text = db.Column(db.Text, nullable=True)  # OCR-extracted text
    tf_idf_vector = db.Column(db.JSON, nullable=True)  # cached sparse-vector terms for matching
    tags = db.Column(db.JSON, default=list)  # ["SPES-eligible", "OWWA-eligible", "PWD", ...]
    is_verified_by_staff = db.Column(db.Boolean, default=False, nullable=False)
    is_flagged = db.Column(db.Boolean, default=False, nullable=False)

    # Personal
    gender = db.Column(db.String(20), nullable=True)
    civil_status = db.Column(db.String(30), nullable=True)
    nationality = db.Column(db.String(100), nullable=True, default="Filipino")
    barangay = db.Column(db.String(150), nullable=True)
    municipality = db.Column(db.String(150), nullable=True)
    province = db.Column(db.String(150), nullable=True)
    profile_picture_url = db.Column(db.String(1000), nullable=True)

    # Employment Information
    employment_status = db.Column(db.String(30), nullable=True)
    preferred_job_position = db.Column(db.String(255), nullable=True)
    preferred_industry = db.Column(db.String(150), nullable=True)
    preferred_work_location = db.Column(db.String(255), nullable=True)
    expected_salary = db.Column(db.String(50), nullable=True)  # free text: allows "Negotiable", ranges
    employment_type = db.Column(db.String(30), nullable=True)

    # Skills breakdown
    technical_skills = db.Column(db.JSON, default=list)
    soft_skills = db.Column(db.JSON, default=list)
    languages_spoken = db.Column(db.JSON, default=list)
    certifications = db.Column(db.JSON, default=list)

    # Verification
    verification_remarks = db.Column(db.Text, nullable=True)

    user = db.relationship("User", back_populates="jobseeker_profile")
    work_experiences = db.relationship(
        "WorkExperience", back_populates="profile", cascade="all, delete-orphan", order_by="WorkExperience.created_at.desc()"
    )
    educations = db.relationship(
        "Education", back_populates="profile", cascade="all, delete-orphan", order_by="Education.created_at.desc()"
    )
    documents = db.relationship(
        "JobseekerDocument", back_populates="profile", cascade="all, delete-orphan", order_by="JobseekerDocument.created_at.desc()"
    )

    def age(self):
        if not self.date_of_birth:
            return None
        from utils.timezone import now_manila

        today = now_manila().date()
        dob = self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    def _completion_breakdown(self) -> dict:
        personal = [
            self.full_name, self.contact_number, self.date_of_birth, self.gender,
            self.civil_status, self.nationality, self.barangay, self.municipality, self.province,
        ]
        personal_score = sum(1 for f in personal if f) / len(personal)

        doc_types = {d.document_type for d in self.documents}
        doc_checks = [bool(self.resume_url), "government_id" in doc_types]
        documents_score = sum(doc_checks) / len(doc_checks)

        employment = [
            self.employment_status, self.preferred_job_position, self.preferred_industry,
            self.preferred_work_location, self.expected_salary, self.employment_type,
        ]
        employment_score = sum(1 for f in employment if f) / len(employment)

        education_score = 1.0 if any(e.school and e.attainment_level for e in self.educations) else 0.0
        skills_score = sum([bool(self.technical_skills), bool(self.soft_skills)]) / 2

        return {
            "personal": personal_score,
            "documents": documents_score,
            "employment": employment_score,
            "education": education_score,
            "skills": skills_score,
        }

    def profile_completion(self) -> int:
        breakdown = self._completion_breakdown()
        total = (
            breakdown["personal"] * 25
            + breakdown["documents"] * 25
            + breakdown["employment"] * 20
            + breakdown["education"] * 15
            + breakdown["skills"] * 15
        )
        return round(total)

    def to_dict(self, include_email=None):
        derived_address = ", ".join(filter(None, [self.barangay, self.municipality, self.province])) or self.address
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "email": include_email,
            "full_name": self.full_name,
            "contact_number": self.contact_number,
            "address": derived_address,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.age(),
            "gender": self.gender,
            "civil_status": self.civil_status,
            "nationality": self.nationality,
            "barangay": self.barangay,
            "municipality": self.municipality,
            "province": self.province,
            "profile_picture_url": self.profile_picture_url,
            "employment_status": self.employment_status,
            "preferred_job_position": self.preferred_job_position,
            "preferred_industry": self.preferred_industry,
            "preferred_work_location": self.preferred_work_location,
            "expected_salary": self.expected_salary,
            "employment_type": self.employment_type,
            "technical_skills": self.technical_skills or [],
            "soft_skills": self.soft_skills or [],
            "languages_spoken": self.languages_spoken or [],
            "certifications": self.certifications or [],
            "skills": self.skills or [],
            "resume_url": self.resume_url,
            "tags": self.tags or [],
            "is_verified_by_staff": self.is_verified_by_staff,
            "verification_remarks": self.verification_remarks,
            "profile_completion": self.profile_completion(),
            "completion_breakdown": self._completion_breakdown(),
            "work_experiences": [w.to_dict() for w in self.work_experiences],
            "educations": [e.to_dict() for e in self.educations],
            "documents": [d.to_dict() for d in self.documents],
        }


class WorkExperience(BaseModel):
    __tablename__ = "work_experiences"

    profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    company = db.Column(db.String(255), nullable=False)
    position = db.Column(db.String(255), nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    description = db.Column(db.Text, nullable=True)

    profile = db.relationship("JobseekerProfile", back_populates="work_experiences")

    def to_dict(self):
        return {
            "id": str(self.id),
            "company": self.company,
            "position": self.position,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "description": self.description,
        }


class Education(BaseModel):
    __tablename__ = "educations"

    profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    school = db.Column(db.String(255), nullable=False)
    degree = db.Column(db.String(255), nullable=True)  # course/program — nullable to allow "N/A"
    graduation_year = db.Column(db.Integer, nullable=True)
    attainment_level = db.Column(db.String(50), nullable=True)
    honors = db.Column(db.String(255), nullable=True)

    profile = db.relationship("JobseekerProfile", back_populates="educations")

    def to_dict(self):
        return {
            "id": str(self.id),
            "school": self.school,
            "degree": self.degree,
            "graduation_year": self.graduation_year,
            "attainment_level": self.attainment_level,
            "honors": self.honors,
        }


class JobseekerDocument(BaseModel):
    __tablename__ = "jobseeker_documents"

    profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)
    file_url = db.Column(db.String(1000), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)

    profile = db.relationship("JobseekerProfile", back_populates="documents")

    __table_args__ = (
        db.CheckConstraint(
            "document_type IN ('government_id', 'id_photo_2x2', 'diploma', 'training_certificate', 'certificate_of_employment')",
            name="ck_jobseeker_document_type",
        ),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_type": self.document_type,
            "file_url": self.file_url,
            "original_filename": self.original_filename,
            "uploaded_at": self.created_at.isoformat() if self.created_at else None,
        }
