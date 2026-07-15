from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

APPLICATION_STATUSES = (
    "applied", "under_review", "shortlisted", "interview_scheduled", "interview_completed",
    "background_verification", "offer_extended", "hired", "rejected", "cancelled",
)

# Human-facing labels for the application pipeline (DB values stay stable).
APPLICATION_STATUS_LABELS = {
    "applied": "Application Submitted",
    "under_review": "Documents Under Review",
    "shortlisted": "Shortlisted",
    "interview_scheduled": "Interview Scheduled",
    "interview_completed": "Interview Completed",
    "background_verification": "Background Verification",
    "offer_extended": "Job Offer",
    "hired": "Hired",
    "rejected": "Rejected",
    "cancelled": "Withdrawn",
}


class Application(BaseModel):
    __tablename__ = "applications"

    vacancy_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancies.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    status = db.Column(db.String(30), default="applied", nullable=False)
    match_score = db.Column(db.Float, nullable=True)
    employer_notes = db.Column(db.Text, nullable=True)
    feedback_note = db.Column(db.Text, nullable=True)  # visible to jobseeker

    vacancy = db.relationship("Vacancy", back_populates="applications")
    jobseeker_profile = db.relationship("JobseekerProfile")
    referral_letter = db.relationship("ReferralLetter", back_populates="application", uselist=False)
    interviews = db.relationship("Interview", back_populates="application", cascade="all, delete-orphan")
    status_history = db.relationship(
        "ApplicationStatusHistory", back_populates="application",
        cascade="all, delete-orphan", order_by="ApplicationStatusHistory.created_at",
    )

    __table_args__ = (
        db.UniqueConstraint("vacancy_id", "jobseeker_profile_id", name="uq_application_vacancy_jobseeker"),
        db.CheckConstraint(f"status IN {APPLICATION_STATUSES}", name="ck_application_status"),
    )

    @property
    def reference_no(self):
        vacancy = self.vacancy
        if vacancy and vacancy.vacancy_no:
            return vacancy.vacancy_no
        return f"VAC-{str(self.vacancy_id).replace('-', '')[:8].upper()}"

    def to_dict(self):
        company = self.vacancy.employer_company if self.vacancy else None
        return {
            "id": str(self.id),
            "vacancy_id": str(self.vacancy_id),
            "job_title": self.vacancy.title if self.vacancy else None,
            "company_name": company.company_name if company else None,
            "company_logo_url": company.logo_url if company else None,
            "reference_no": self.reference_no,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "status": self.status,
            "status_label": APPLICATION_STATUS_LABELS.get(self.status, self.status),
            "match_score": self.match_score,
            "employer_notes": self.employer_notes,
            "feedback_note": self.feedback_note,
            "has_referral_letter": self.referral_letter is not None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ApplicationStatusHistory(BaseModel):
    __tablename__ = "application_status_history"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = db.Column(db.String(30), nullable=True)  # null for the initial event
    to_status = db.Column(db.String(30), nullable=False)
    changed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # null = system
    note = db.Column(db.Text, nullable=True)

    application = db.relationship("Application", back_populates="status_history")
    changed_by_user = db.relationship("User")

    def to_dict(self):
        actor = self.changed_by_user
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "to_status_label": APPLICATION_STATUS_LABELS.get(self.to_status, self.to_status),
            "changed_by_role": actor.role if actor else "system",
            "note": self.note,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
