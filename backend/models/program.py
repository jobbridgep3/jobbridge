from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

PROGRAM_TYPES = ("spes", "dilp", "owwa")
PROGRAM_STATUSES = ("submitted", "under_review", "approved", "rejected", "endorsed", "for_release", "completed")


class ProgramApplication(BaseModel):
    """Shared model for SPES / DILP / OWWA — identical shape (form data + docs + review workflow),
    differentiated by program_type. Each still gets its own /api/<program> routes and frontend pages."""

    __tablename__ = "program_applications"

    program_type = db.Column(db.String(10), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    form_data = db.Column(db.JSON, nullable=False, default=dict)
    document_urls = db.Column(db.JSON, nullable=False, default=list)
    status = db.Column(db.String(20), default="submitted", nullable=False)
    remarks = db.Column(db.Text, nullable=True)
    release_date = db.Column(db.Date, nullable=True)
    release_amount = db.Column(db.Numeric(12, 2), nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobseeker_profile = db.relationship("JobseekerProfile")

    __table_args__ = (
        db.CheckConstraint(f"program_type IN {PROGRAM_TYPES}", name="ck_program_type"),
        db.CheckConstraint(f"status IN {PROGRAM_STATUSES}", name="ck_program_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "program_type": self.program_type,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "form_data": self.form_data or {},
            "document_urls": self.document_urls or [],
            "status": self.status,
            "remarks": self.remarks,
            "release_date": self.release_date.isoformat() if self.release_date else None,
            "release_amount": float(self.release_amount) if self.release_amount is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
