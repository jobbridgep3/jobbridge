from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

VACANCY_STATUSES = ("pending", "active", "rejected", "closed")


class Vacancy(BaseModel):
    __tablename__ = "vacancies"

    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    requirements = db.Column(db.Text, nullable=True)
    skills_required = db.Column(db.Text, nullable=True)  # free text, tokenized for TF-IDF
    salary_min = db.Column(db.Numeric(12, 2), nullable=True)
    salary_max = db.Column(db.Numeric(12, 2), nullable=True)
    job_type = db.Column(db.String(30), nullable=True)  # full-time | part-time | contractual
    industry = db.Column(db.String(150), nullable=True)
    num_slots = db.Column(db.Integer, default=1)
    work_location = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="pending", nullable=False)
    rejection_remarks = db.Column(db.Text, nullable=True)
    is_manual_entry = db.Column(db.Boolean, default=False)  # added by staff for walk-in employer
    tagged_for_jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=True)
    approved_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime(timezone=True), nullable=True)

    employer_company = db.relationship("EmployerCompany")
    applications = db.relationship("Application", back_populates="vacancy", cascade="all, delete-orphan")

    __table_args__ = (db.CheckConstraint(f"status IN {VACANCY_STATUSES}", name="ck_vacancy_status"),)

    def to_dict(self, match_score=None):
        company = self.employer_company
        return {
            "id": str(self.id),
            "employer_company_id": str(self.employer_company_id),
            "company_name": company.company_name if company else None,
            "company_logo_url": company.logo_url if company else None,
            "title": self.title,
            "description": self.description,
            "requirements": self.requirements,
            "skills_required": self.skills_required,
            "salary_min": float(self.salary_min) if self.salary_min is not None else None,
            "salary_max": float(self.salary_max) if self.salary_max is not None else None,
            "job_type": self.job_type,
            "industry": self.industry,
            "num_slots": self.num_slots,
            "work_location": self.work_location,
            "status": self.status,
            "rejection_remarks": self.rejection_remarks,
            "match_score": match_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
