from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

REFERRAL_STATUSES = ("requested", "approved", "rejected")
EMPLOYER_REFERRAL_STATUSES = ("pending", "accepted", "rejected")


class ReferralLetter(BaseModel):
    """Jobseeker-requested PESO referral letter.

    Flow: jobseeker requests (optionally for a specific vacancy) → PESO staff
    approves (PDF generated) or rejects → an approved letter auto-attaches to the
    matching application when the jobseeker applies. Legacy rows (pre-request-flow)
    were backfilled as approved, staff-issued letters.
    """

    __tablename__ = "referral_letters"

    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False, index=True)
    vacancy_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancies.id"), nullable=True)  # null = general referral
    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), nullable=True, index=True)
    status = db.Column(db.String(20), default="requested", nullable=False)
    reason = db.Column(db.Text, nullable=True)  # jobseeker's purpose for the request
    requested_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)  # null = staff-issued
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    rejection_reason = db.Column(db.Text, nullable=True)
    generated_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    pdf_url = db.Column(db.String(1000), nullable=True)  # set on approval

    # Employer-facing review, separate from the PESO-staff `status` above.
    # NULL = not yet employer-visible (still PESO-pending/rejected, or a
    # general referral with no vacancy_id — see EMPLOYER_REFERRAL_STATUSES).
    employer_status = db.Column(db.String(20), nullable=True)
    employer_rejection_reason = db.Column(db.Text, nullable=True)
    reviewed_by_employer = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    employer_reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    referral_number = db.Column(db.String(20), unique=True, nullable=True)  # e.g. REF-2026-00001, assigned when first employer-visible

    jobseeker_profile = db.relationship("JobseekerProfile")
    vacancy = db.relationship("Vacancy")
    application = db.relationship("Application", back_populates="referral_letter")
    reviewed_by_employer_user = db.relationship("User", foreign_keys=[reviewed_by_employer])

    __table_args__ = (db.CheckConstraint(f"status IN {REFERRAL_STATUSES}", name="ck_referral_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "vacancy_id": str(self.vacancy_id) if self.vacancy_id else None,
            "job_title": self.vacancy.title if self.vacancy else None,
            "company_name": self.vacancy.employer_company.company_name if self.vacancy and self.vacancy.employer_company else None,
            "application_id": str(self.application_id) if self.application_id else None,
            "status": self.status,
            "reason": self.reason,
            "rejection_reason": self.rejection_reason,
            "pdf_url": self.pdf_url,
            "employer_status": self.employer_status,
            "employer_rejection_reason": self.employer_rejection_reason,
            "employer_reviewed_at": self.employer_reviewed_at.isoformat() if self.employer_reviewed_at else None,
            "referral_number": self.referral_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
