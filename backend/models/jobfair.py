import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

JOBFAIR_STATUSES = ("upcoming", "ongoing", "completed", "cancelled")


class JobFair(BaseModel):
    __tablename__ = "jobfairs"

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    venue = db.Column(db.String(500), nullable=False)
    event_date = db.Column(db.DateTime(timezone=True), nullable=False)
    max_employer_slots = db.Column(db.Integer, default=20)
    max_jobseeker_slots = db.Column(db.Integer, default=200)
    status = db.Column(db.String(20), default="upcoming", nullable=False)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    registrations = db.relationship("JobFairRegistration", back_populates="jobfair", cascade="all, delete-orphan")
    booths = db.relationship("JobFairBooth", back_populates="jobfair", cascade="all, delete-orphan")

    __table_args__ = (db.CheckConstraint(f"status IN {JOBFAIR_STATUSES}", name="ck_jobfair_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "venue": self.venue,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "max_employer_slots": self.max_employer_slots,
            "max_jobseeker_slots": self.max_jobseeker_slots,
            "status": self.status,
            "registered_jobseekers": len(self.registrations),
            "registered_employers": len(self.booths),
        }


class JobFairRegistration(BaseModel):
    __tablename__ = "jobfair_registrations"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    qr_token = db.Column(db.String(64), unique=True, default=lambda: uuid.uuid4().hex, nullable=False)
    attended = db.Column(db.Boolean, default=False)
    scanned_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobfair = db.relationship("JobFair", back_populates="registrations")
    jobseeker_profile = db.relationship("JobseekerProfile")

    __table_args__ = (db.UniqueConstraint("jobfair_id", "jobseeker_profile_id", name="uq_jobfair_jobseeker"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobfair_id": str(self.jobfair_id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "qr_token": self.qr_token,
            "attended": self.attended,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
        }


class JobFairBooth(BaseModel):
    __tablename__ = "jobfair_booths"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)

    jobfair = db.relationship("JobFair", back_populates="booths")
    employer_company = db.relationship("EmployerCompany")

    __table_args__ = (db.UniqueConstraint("jobfair_id", "employer_company_id", name="uq_jobfair_employer"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobfair_id": str(self.jobfair_id),
            "employer_company_id": str(self.employer_company_id),
            "company_name": self.employer_company.company_name if self.employer_company else None,
        }
