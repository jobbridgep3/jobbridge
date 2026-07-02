from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

EMPLOYMENT_STATUSES = ("active", "terminated", "completed")


class EmploymentRecord(BaseModel):
    __tablename__ = "employment_records"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), nullable=True)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)
    position = db.Column(db.String(255), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default="active", nullable=False)
    termination_reason = db.Column(db.Text, nullable=True)
    is_walk_in = db.Column(db.Boolean, default=False)  # manually entered by staff, not via system application
    flagged_discrepancy = db.Column(db.Boolean, default=False)

    jobseeker_profile = db.relationship("JobseekerProfile")
    employer_company = db.relationship("EmployerCompany")

    __table_args__ = (db.CheckConstraint(f"status IN {EMPLOYMENT_STATUSES}", name="ck_employment_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "employer_company_id": str(self.employer_company_id),
            "employer_name": self.employer_company.company_name if self.employer_company else None,
            "position": self.position,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "termination_reason": self.termination_reason,
            "is_walk_in": self.is_walk_in,
            "flagged_discrepancy": self.flagged_discrepancy,
        }
