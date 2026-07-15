from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

EMPLOYMENT_STATUSES = (
    "pending_deployment", "active", "probationary", "regular",
    "contract_ended", "resigned", "terminated", "completed",
)

EMPLOYMENT_STATUS_LABELS = {
    "pending_deployment": "Pending Deployment",
    "active": "Active Employee",
    "probationary": "Probationary",
    "regular": "Regular",
    "contract_ended": "Contract Ended",
    "resigned": "Resigned",
    "terminated": "Terminated",
    "completed": "Contract Ended",  # legacy value, same meaning
}

# Statuses that end the employment (set end_date when entered).
EMPLOYMENT_END_STATUSES = ("contract_ended", "resigned", "terminated", "completed")


class EmploymentRecord(BaseModel):
    __tablename__ = "employment_records"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), nullable=True)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)
    position = db.Column(db.String(255), nullable=False)
    salary = db.Column(db.Numeric(12, 2), nullable=True)
    employment_type = db.Column(db.String(30), nullable=True)
    work_arrangement = db.Column(db.String(30), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), default="pending_deployment", nullable=False)
    termination_reason = db.Column(db.Text, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    is_walk_in = db.Column(db.Boolean, default=False)  # manually entered by staff, not via system application
    flagged_discrepancy = db.Column(db.Boolean, default=False)

    jobseeker_profile = db.relationship("JobseekerProfile")
    employer_company = db.relationship("EmployerCompany")
    status_history = db.relationship(
        "EmploymentStatusHistory", back_populates="record",
        cascade="all, delete-orphan", order_by="EmploymentStatusHistory.created_at",
    )

    __table_args__ = (db.CheckConstraint(f"status IN {EMPLOYMENT_STATUSES}", name="ck_employment_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "application_id": str(self.application_id) if self.application_id else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "employer_company_id": str(self.employer_company_id),
            "employer_name": self.employer_company.company_name if self.employer_company else None,
            "position": self.position,
            "salary": float(self.salary) if self.salary is not None else None,
            "employment_type": self.employment_type,
            "work_arrangement": self.work_arrangement,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "status": self.status,
            "status_label": EMPLOYMENT_STATUS_LABELS.get(self.status, self.status),
            "termination_reason": self.termination_reason,
            "remarks": self.remarks,
            "is_walk_in": self.is_walk_in,
            "flagged_discrepancy": self.flagged_discrepancy,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EmploymentStatusHistory(BaseModel):
    __tablename__ = "employment_status_history"

    record_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employment_records.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = db.Column(db.String(20), nullable=True)  # null for the initial event
    to_status = db.Column(db.String(20), nullable=False)
    changed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    note = db.Column(db.Text, nullable=True)

    record = db.relationship("EmploymentRecord", back_populates="status_history")
    changed_by_user = db.relationship("User")

    def to_dict(self):
        actor = self.changed_by_user
        return {
            "id": str(self.id),
            "record_id": str(self.record_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "to_status_label": EMPLOYMENT_STATUS_LABELS.get(self.to_status, self.to_status),
            "changed_by_role": actor.role if actor else "system",
            "note": self.note,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
