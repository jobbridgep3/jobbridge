from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

INTERVIEW_STATUSES = ("pending", "accepted", "declined", "completed", "cancelled")


class Interview(BaseModel):
    __tablename__ = "interviews"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), nullable=False)
    scheduled_date = db.Column(db.DateTime(timezone=True), nullable=False)
    mode = db.Column(db.String(20), nullable=False, default="onsite")  # onsite | online
    location = db.Column(db.String(500), nullable=True)  # address or meeting link
    status = db.Column(db.String(20), default="pending", nullable=False)
    notes = db.Column(db.Text, nullable=True)  # internal, employer-only
    decline_reason = db.Column(db.Text, nullable=True)

    application = db.relationship("Application", back_populates="interviews")

    __table_args__ = (db.CheckConstraint(f"status IN {INTERVIEW_STATUSES}", name="ck_interview_status"),)

    def to_dict(self):
        app = self.application
        vacancy = app.vacancy if app else None
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "job_title": vacancy.title if vacancy else None,
            "company_name": vacancy.employer_company.company_name if vacancy and vacancy.employer_company else None,
            "jobseeker_name": app.jobseeker_profile.full_name if app and app.jobseeker_profile else None,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "mode": self.mode,
            "location": self.location,
            "status": self.status,
            "notes": self.notes,
            "decline_reason": self.decline_reason,
        }
