import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

JOBFAIR_STATUSES = ("draft", "published", "ongoing", "completed", "cancelled", "archived")
BOOTH_STATUSES = ("pending", "confirmed", "cancelled", "rejected", "suspended")


class JobFair(BaseModel):
    __tablename__ = "jobfairs"

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    banner_url = db.Column(db.String(1000), nullable=True)
    venue = db.Column(db.String(500), nullable=False)
    municipality = db.Column(db.String(150), nullable=True)
    event_date = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=True)
    registration_deadline = db.Column(db.DateTime(timezone=True), nullable=True)
    max_employer_slots = db.Column(db.Integer, default=20)
    max_jobseeker_slots = db.Column(db.Integer, default=200)
    contact_person = db.Column(db.String(255), nullable=True)
    contact_number = db.Column(db.String(30), nullable=True)
    requirements = db.Column(db.Text, nullable=True)
    attachments = db.Column(db.JSON, default=list)  # [{"name": ..., "url": ...}]
    status = db.Column(db.String(20), default="draft", nullable=False)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    registrations = db.relationship("JobFairRegistration", back_populates="jobfair", cascade="all, delete-orphan")
    booths = db.relationship("JobFairBooth", back_populates="jobfair", cascade="all, delete-orphan")

    __table_args__ = (db.CheckConstraint(f"status IN {JOBFAIR_STATUSES}", name="ck_jobfair_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "banner_url": self.banner_url,
            "venue": self.venue,
            "municipality": self.municipality,
            "event_date": self.event_date.isoformat() if self.event_date else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "registration_deadline": self.registration_deadline.isoformat() if self.registration_deadline else None,
            "max_employer_slots": self.max_employer_slots,
            "max_jobseeker_slots": self.max_jobseeker_slots,
            "contact_person": self.contact_person,
            "contact_number": self.contact_number,
            "requirements": self.requirements,
            "attachments": self.attachments or [],
            "status": self.status,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "registered_jobseekers": len(self.registrations),
            "registered_employers": len(self.booths),
            "attended_count": sum(1 for r in self.registrations if r.attended),
        }


class JobFairRegistration(BaseModel):
    __tablename__ = "jobfair_registrations"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    registration_number = db.Column(db.String(20), unique=True, nullable=True)
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
            "jobfair_name": self.jobfair.name if self.jobfair else None,
            "event_date": self.jobfair.event_date.isoformat() if self.jobfair and self.jobfair.event_date else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "registration_number": self.registration_number,
            "qr_token": self.qr_token,
            "attended": self.attended,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobFairBooth(BaseModel):
    __tablename__ = "jobfair_booths"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)
    status = db.Column(db.String(20), default="pending", nullable=False)
    booth_name = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    materials = db.Column(db.JSON, default=list)  # [{"name": ..., "url": ...}] banners / promo files
    review_remarks = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobfair = db.relationship("JobFair", back_populates="booths")
    employer_company = db.relationship("EmployerCompany")
    reviewed_by_user = db.relationship("User", foreign_keys=[reviewed_by])

    __table_args__ = (
        db.UniqueConstraint("jobfair_id", "employer_company_id", name="uq_jobfair_employer"),
        db.CheckConstraint(f"status IN {BOOTH_STATUSES}", name="ck_booth_status"),
    )

    def to_dict(self):
        company = self.employer_company
        return {
            "id": str(self.id),
            "jobfair_id": str(self.jobfair_id),
            "employer_company_id": str(self.employer_company_id),
            "company_name": company.company_name if company else None,
            "company_logo_url": company.logo_url if company else None,
            "status": self.status,
            "booth_name": self.booth_name,
            "description": self.description,
            "materials": self.materials or [],
            "review_remarks": self.review_remarks,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "reviewed_by_name": self.reviewed_by_user.email if self.reviewed_by_user else None,
        }
