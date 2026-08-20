from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

MANPOWER_APPLICATION_STATUSES = ("pending", "pooled", "submitted_to_tesda", "for_tesda_response", "completed", "declined")
MANPOWER_BATCH_STATUSES = ("forming", "submitted_to_tesda", "for_tesda_response", "completed", "declined")


class ManpowerTrainingBatch(BaseModel):
    """A pool of applicants (min 15 pax) formalized into a project proposal and submitted to TESDA.
    Batch-level status cascades to every linked, still-pooled application (see blueprints/manpower_training.py)."""

    __tablename__ = "manpower_training_batches"

    batch_name = db.Column(db.String(255), nullable=False)
    min_pax = db.Column(db.Integer, nullable=False, default=15)
    max_pax = db.Column(db.Integer, nullable=True)  # None = unlimited, matches JobFair.max_*_slots convention
    status = db.Column(db.String(20), default="forming", nullable=False)
    project_proposal_url = db.Column(db.String(1000), nullable=True)
    submitted_to_tesda_date = db.Column(db.DateTime(timezone=True), nullable=True)
    tesda_response_date = db.Column(db.DateTime(timezone=True), nullable=True)

    applications = db.relationship("ManpowerTrainingApplication", back_populates="batch")

    __table_args__ = (
        db.CheckConstraint(f"status IN {MANPOWER_BATCH_STATUSES}", name="ck_manpower_batch_status"),
    )

    def to_dict(self):
        pooled_apps = [a for a in self.applications if a.status != "declined"]
        current_pax = len(pooled_apps)
        slots_remaining = max(self.max_pax - current_pax, 0) if self.max_pax is not None else None
        return {
            "id": str(self.id),
            "batch_name": self.batch_name,
            "min_pax": self.min_pax,
            "max_pax": self.max_pax,
            "current_pax": current_pax,
            "slots_remaining": slots_remaining,
            "is_full": slots_remaining is not None and slots_remaining <= 0,
            "status": self.status,
            "project_proposal_url": self.project_proposal_url,
            "submitted_to_tesda_date": self.submitted_to_tesda_date.isoformat() if self.submitted_to_tesda_date else None,
            "tesda_response_date": self.tesda_response_date.isoformat() if self.tesda_response_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ManpowerTrainingApplication(BaseModel):
    """Jobseeker referral into the Manpower Skills Training Program — pooled into a batch,
    then submitted to TESDA as part of that batch's project proposal."""

    __tablename__ = "manpower_training_applications"

    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    batch_id = db.Column(UUID(as_uuid=True), db.ForeignKey("manpower_training_batches.id"), nullable=True)
    status = db.Column(db.String(20), default="pending", nullable=False)
    program_interest = db.Column(db.String(255), nullable=False)
    application_date = db.Column(db.DateTime(timezone=True), nullable=True)
    staff_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    remarks = db.Column(db.Text, nullable=True)

    jobseeker_profile = db.relationship("JobseekerProfile")
    batch = db.relationship("ManpowerTrainingBatch", back_populates="applications")

    __table_args__ = (
        db.CheckConstraint(f"status IN {MANPOWER_APPLICATION_STATUSES}", name="ck_manpower_application_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "batch_id": str(self.batch_id) if self.batch_id else None,
            "batch_name": self.batch.batch_name if self.batch else None,
            "project_proposal_url": self.batch.project_proposal_url if self.batch else None,
            "submitted_to_tesda_date": self.batch.submitted_to_tesda_date.isoformat() if self.batch and self.batch.submitted_to_tesda_date else None,
            "tesda_response_date": self.batch.tesda_response_date.isoformat() if self.batch and self.batch.tesda_response_date else None,
            "status": self.status,
            "program_interest": self.program_interest,
            "application_date": self.application_date.isoformat() if self.application_date else None,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
