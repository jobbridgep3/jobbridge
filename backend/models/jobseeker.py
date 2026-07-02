from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class JobseekerProfile(BaseModel):
    __tablename__ = "jobseeker_profiles"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False, default="")
    contact_number = db.Column(db.String(30), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    skills = db.Column(db.JSON, default=list)  # ["Python", "Customer Service", ...]
    resume_url = db.Column(db.String(1000), nullable=True)
    resume_raw_text = db.Column(db.Text, nullable=True)  # OCR-extracted text
    tf_idf_vector = db.Column(db.JSON, nullable=True)  # cached sparse-vector terms for matching
    tags = db.Column(db.JSON, default=list)  # ["SPES-eligible", "OWWA-eligible", "PWD", ...]
    is_verified_by_staff = db.Column(db.Boolean, default=False, nullable=False)
    is_flagged = db.Column(db.Boolean, default=False, nullable=False)

    user = db.relationship("User", back_populates="jobseeker_profile")
    work_experiences = db.relationship(
        "WorkExperience", back_populates="profile", cascade="all, delete-orphan", order_by="WorkExperience.created_at.desc()"
    )
    educations = db.relationship(
        "Education", back_populates="profile", cascade="all, delete-orphan", order_by="Education.created_at.desc()"
    )

    def profile_completion(self) -> int:
        fields = [self.full_name, self.contact_number, self.address, self.date_of_birth, self.resume_url]
        filled = sum(1 for f in fields if f)
        skill_bonus = 1 if self.skills else 0
        exp_bonus = 1 if self.work_experiences else 0
        edu_bonus = 1 if self.educations else 0
        total = len(fields) + 3
        return round(((filled + skill_bonus + exp_bonus + edu_bonus) / total) * 100)

    def to_dict(self, include_email=None):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "email": include_email,
            "full_name": self.full_name,
            "contact_number": self.contact_number,
            "address": self.address,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "skills": self.skills or [],
            "resume_url": self.resume_url,
            "tags": self.tags or [],
            "is_verified_by_staff": self.is_verified_by_staff,
            "profile_completion": self.profile_completion(),
            "work_experiences": [w.to_dict() for w in self.work_experiences],
            "educations": [e.to_dict() for e in self.educations],
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
    degree = db.Column(db.String(255), nullable=False)
    graduation_year = db.Column(db.Integer, nullable=True)

    profile = db.relationship("JobseekerProfile", back_populates="educations")

    def to_dict(self):
        return {
            "id": str(self.id),
            "school": self.school,
            "degree": self.degree,
            "graduation_year": self.graduation_year,
        }
