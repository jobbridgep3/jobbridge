from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

# Full lifecycle state machine (see services/vacancy_state_service.py for the
# transition map): draft -> pending -> approved/rejected -> published -> closed/filled,
# with suspend/reactivate as staff/admin-only side branches. Replaces the old
# 4-state (pending|active|rejected|closed) enum — "active" becomes "published".
VACANCY_STATUSES = ("draft", "pending", "approved", "rejected", "published", "suspended", "closed", "filled")

WORK_ARRANGEMENTS = ("onsite", "remote", "hybrid")
GENDERS = ("Male", "Female", "Any")
CIVIL_STATUSES = ("Single", "Married", "Widowed", "Separated", "Divorced", "Any")
SCREENING_QUESTION_TYPES = ("text", "yes_no", "multiple_choice")


class Vacancy(BaseModel):
    __tablename__ = "vacancies"

    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)

    # Basic
    title = db.Column(db.String(255), nullable=False)
    category_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancy_categories.id"), nullable=True)
    industry = db.Column(db.String(150), nullable=True)
    department = db.Column(db.String(150), nullable=True)
    vacancy_no = db.Column(db.String(50), nullable=True)
    num_slots = db.Column(db.Integer, default=1)
    job_type = db.Column(db.String(30), nullable=True)  # "Employment Type" in the UI: full-time|part-time|contractual|seasonal|internship
    work_arrangement = db.Column(db.String(20), nullable=True)
    schedule = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="draft", nullable=False)

    # Description (legacy free-text fallback fields, still populated for backward
    # compatibility with matching_service/existing detail views)
    description = db.Column(db.Text, nullable=False, default="")
    requirements = db.Column(db.Text, nullable=True)
    # Description (rich text HTML, sanitized server-side before persisting)
    summary = db.Column(db.Text, nullable=True)
    responsibilities = db.Column(db.Text, nullable=True)
    daily_tasks = db.Column(db.Text, nullable=True)

    # Qualifications
    education_level = db.Column(db.String(50), nullable=True)
    course = db.Column(db.String(150), nullable=True)
    min_experience_years = db.Column(db.SmallInteger, nullable=True)
    fresh_grad_ok = db.Column(db.Boolean, default=False)
    required_skills = db.Column(db.JSON, default=list)
    required_certifications = db.Column(db.JSON, default=list)
    skills_required = db.Column(db.Text, nullable=True)  # free text, tokenized for TF-IDF — kept in sync with required_skills

    # Salary
    salary_min = db.Column(db.Numeric(12, 2), nullable=True)
    salary_max = db.Column(db.Numeric(12, 2), nullable=True)
    hide_salary = db.Column(db.Boolean, default=False)
    benefits = db.Column(db.JSON, default=list)

    # Location (legacy free-text fallback + structured PSGC address, same pattern
    # as EmployerCompany/EmployerHRProfile)
    work_location = db.Column(db.String(255), nullable=True)
    region_code = db.Column(db.String(10), nullable=True)
    region_name = db.Column(db.String(150), nullable=True)
    province_code = db.Column(db.String(10), nullable=True)
    province_name = db.Column(db.String(150), nullable=True)
    city_municipality_code = db.Column(db.String(10), nullable=True)
    city_municipality_name = db.Column(db.String(150), nullable=True)
    barangay_code = db.Column(db.String(15), nullable=True)
    barangay_name = db.Column(db.String(150), nullable=True)
    street_address = db.Column(db.String(255), nullable=True)
    zip_code = db.Column(db.String(10), nullable=True)

    # Hiring Details
    posting_date = db.Column(db.Date, nullable=True)
    application_deadline = db.Column(db.Date, nullable=True)
    expected_start_date = db.Column(db.Date, nullable=True)

    # Applicant Preferences (optional)
    pref_age_min = db.Column(db.SmallInteger, nullable=True)
    pref_age_max = db.Column(db.SmallInteger, nullable=True)
    pref_gender = db.Column(db.String(20), nullable=True)
    pref_civil_status = db.Column(db.String(30), nullable=True)
    pref_languages = db.Column(db.JSON, default=list)
    fresh_grad_friendly = db.Column(db.Boolean, default=False)
    pwd_friendly = db.Column(db.Boolean, default=False)
    senior_citizen_friendly = db.Column(db.Boolean, default=False)
    ofw_friendly = db.Column(db.Boolean, default=False)

    # Required Documents (applicant-facing picklist)
    required_applicant_documents = db.Column(db.JSON, default=list)

    # Contact Person
    contact_name = db.Column(db.String(255), nullable=True)
    contact_email = db.Column(db.String(255), nullable=True)
    contact_number = db.Column(db.String(30), nullable=True)

    # Additional Information
    culture_description = db.Column(db.Text, nullable=True)
    career_growth_description = db.Column(db.Text, nullable=True)
    additional_notes = db.Column(db.Text, nullable=True)

    # Smart features
    is_template = db.Column(db.Boolean, default=False)
    template_name = db.Column(db.String(150), nullable=True)
    duplicated_from_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancies.id"), nullable=True)

    # Status machine support
    rejection_remarks = db.Column(db.Text, nullable=True)
    suspended_reason = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    approved_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    approved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    filled_at = db.Column(db.DateTime(timezone=True), nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)  # soft-delete, admin restore (Phase 7)

    is_manual_entry = db.Column(db.Boolean, default=False)  # added by staff for walk-in employer
    tagged_for_jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=True)

    employer_company = db.relationship("EmployerCompany")
    category = db.relationship("VacancyCategory")
    applications = db.relationship("Application", back_populates="vacancy", cascade="all, delete-orphan")
    screening_questions = db.relationship(
        "VacancyScreeningQuestion", back_populates="vacancy", cascade="all, delete-orphan",
        order_by="VacancyScreeningQuestion.display_order",
    )

    __table_args__ = (
        db.CheckConstraint(f"status IN {VACANCY_STATUSES}", name="ck_vacancy_status"),
        db.CheckConstraint(f"work_arrangement IN {WORK_ARRANGEMENTS}", name="ck_vacancy_work_arrangement"),
    )

    def to_dict(self, match_score=None):
        company = self.employer_company
        return {
            "id": str(self.id),
            "employer_company_id": str(self.employer_company_id),
            "company_name": company.company_name if company else None,
            "company_logo_url": company.logo_url if company else None,
            "title": self.title,
            "category_id": str(self.category_id) if self.category_id else None,
            "category_name": self.category.name if self.category else None,
            "industry": self.industry,
            "department": self.department,
            "vacancy_no": self.vacancy_no,
            "num_slots": self.num_slots,
            "job_type": self.job_type,
            "work_arrangement": self.work_arrangement,
            "schedule": self.schedule,
            "status": self.status,
            "description": self.description,
            "requirements": self.requirements,
            "summary": self.summary,
            "responsibilities": self.responsibilities,
            "daily_tasks": self.daily_tasks,
            "education_level": self.education_level,
            "course": self.course,
            "min_experience_years": self.min_experience_years,
            "fresh_grad_ok": self.fresh_grad_ok,
            "required_skills": self.required_skills or [],
            "required_certifications": self.required_certifications or [],
            "skills_required": self.skills_required,
            "salary_min": float(self.salary_min) if self.salary_min is not None else None,
            "salary_max": float(self.salary_max) if self.salary_max is not None else None,
            "hide_salary": self.hide_salary,
            "benefits": self.benefits or [],
            "work_location": self.work_location,
            "region_code": self.region_code, "region_name": self.region_name,
            "province_code": self.province_code, "province_name": self.province_name,
            "city_municipality_code": self.city_municipality_code, "city_municipality_name": self.city_municipality_name,
            "barangay_code": self.barangay_code, "barangay_name": self.barangay_name,
            "street_address": self.street_address, "zip_code": self.zip_code,
            "posting_date": self.posting_date.isoformat() if self.posting_date else None,
            "application_deadline": self.application_deadline.isoformat() if self.application_deadline else None,
            "expected_start_date": self.expected_start_date.isoformat() if self.expected_start_date else None,
            "pref_age_min": self.pref_age_min,
            "pref_age_max": self.pref_age_max,
            "pref_gender": self.pref_gender,
            "pref_civil_status": self.pref_civil_status,
            "pref_languages": self.pref_languages or [],
            "fresh_grad_friendly": self.fresh_grad_friendly,
            "pwd_friendly": self.pwd_friendly,
            "senior_citizen_friendly": self.senior_citizen_friendly,
            "ofw_friendly": self.ofw_friendly,
            "required_applicant_documents": self.required_applicant_documents or [],
            "contact_name": self.contact_name,
            "contact_email": self.contact_email,
            "contact_number": self.contact_number,
            "culture_description": self.culture_description,
            "career_growth_description": self.career_growth_description,
            "additional_notes": self.additional_notes,
            "is_template": self.is_template,
            "template_name": self.template_name,
            "duplicated_from_id": str(self.duplicated_from_id) if self.duplicated_from_id else None,
            "rejection_remarks": self.rejection_remarks,
            "suspended_reason": self.suspended_reason,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "filled_at": self.filled_at.isoformat() if self.filled_at else None,
            "screening_questions": [q.to_dict() for q in self.screening_questions],
            "match_score": match_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class VacancyCategory(BaseModel):
    __tablename__ = "vacancy_categories"

    name = db.Column(db.String(150), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {"id": str(self.id), "name": self.name, "is_active": self.is_active}


class VacancyScreeningQuestion(BaseModel):
    __tablename__ = "vacancy_screening_questions"

    vacancy_id = db.Column(UUID(as_uuid=True), db.ForeignKey("vacancies.id", ondelete="CASCADE"), nullable=False)
    question_text = db.Column(db.String(500), nullable=False)
    question_type = db.Column(db.String(20), default="text", nullable=False)
    options = db.Column(db.JSON, nullable=True)
    is_required = db.Column(db.Boolean, default=True)
    display_order = db.Column(db.SmallInteger, default=0)

    vacancy = db.relationship("Vacancy", back_populates="screening_questions")

    __table_args__ = (
        db.CheckConstraint(f"question_type IN {SCREENING_QUESTION_TYPES}", name="ck_screening_question_type"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "question_text": self.question_text,
            "question_type": self.question_type,
            "options": self.options or [],
            "is_required": self.is_required,
            "display_order": self.display_order,
        }
