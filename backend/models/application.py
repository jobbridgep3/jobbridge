from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

APPLICATION_STATUSES = ("applied", "under_review", "interview_scheduled", "hired", "rejected", "cancelled")


class Application(BaseModel):
    __tablename__ = "applications"

    vacancy_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancies.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    status = db.Column(db.String(20), default="applied", nullable=False)
    match_score = db.Column(db.Float, nullable=True)
    employer_notes = db.Column(db.Text, nullable=True)
    feedback_note = db.Column(db.Text, nullable=True)  # visible to jobseeker

    vacancy = db.relationship("Vacancy", back_populates="applications")
    jobseeker_profile = db.relationship("JobseekerProfile")
    referral_letter = db.relationship("ReferralLetter", back_populates="application", uselist=False)
    interviews = db.relationship("Interview", back_populates="application", cascade="all, delete-orphan")

    __table_args__ = (
        db.UniqueConstraint("vacancy_id", "jobseeker_profile_id", name="uq_application_vacancy_jobseeker"),
        db.CheckConstraint(f"status IN {APPLICATION_STATUSES}", name="ck_application_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "vacancy_id": str(self.vacancy_id),
            "job_title": self.vacancy.title if self.vacancy else None,
            "company_name": self.vacancy.employer_company.company_name if self.vacancy and self.vacancy.employer_company else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "status": self.status,
            "match_score": self.match_score,
            "employer_notes": self.employer_notes,
            "feedback_note": self.feedback_note,
            "has_referral_letter": self.referral_letter is not None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
