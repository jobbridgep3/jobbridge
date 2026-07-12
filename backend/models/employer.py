from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

# Replaces VERIFICATION_STATUSES (unverified|verified|suspended). Explicit state
# machine, enforced server-side in blueprints/employer.py + blueprints/staff.py:
#   not_submitted --(employer submits, 100% completion)--> pending_review
#   pending_review --(staff/admin approve)--> accredited
#   pending_review --(staff/admin reject + remarks)--> rejected
#   rejected --(employer resubmits)--> pending_review
#   accredited --(staff/admin suspend)--> suspended
#   suspended --(admin reinstate)--> accredited
# Only "accredited" unlocks vacancy submission (enforced in Phase 3/6).
ACCREDITATION_STATUSES = ("not_submitted", "pending_review", "accredited", "rejected", "suspended")

BUSINESS_TYPES = ("corporation", "sole_proprietorship", "cooperative")
COMPANY_SIZES = ("micro", "small", "medium", "large")
HIRING_STATUSES = ("actively_hiring", "not_hiring", "paused")
WORK_SETUPS = ("onsite", "remote", "hybrid")
EMPLOYMENT_TYPES_OFFERED = ("full_time", "part_time", "contractual", "seasonal", "internship")

# Document types a company may submit. Mandatory set (enforced in the profile-
# completion/accreditation-submit gate, not a DB constraint): business_permit,
# business_registration_certificate, bir_registration, company_logo.
COMPANY_DOCUMENT_TYPES = (
    "business_permit", "business_registration_certificate", "bir_registration", "company_logo",
    "philgeps", "mayors_permit", "dole_registration", "peza_certificate", "accreditation_certificate",
    "iso_certificate", "safety_certificate", "rep_gov_id", "authorization_letter", "company_id",
)
COMPANY_MANDATORY_DOCUMENT_TYPES = ("business_permit", "business_registration_certificate", "bir_registration", "company_logo")
DOCUMENT_STATUSES = ("pending_review", "verified", "rejected")

# business_type -> which registration-number field is shown/required alongside the
# always-present BIR TIN + Business Permit (Business Registration section, req. 2).
BUSINESS_TYPE_REGISTRATION_FIELD = {
    "corporation": "sec_number",
    "sole_proprietorship": "dti_number",
    "cooperative": "cda_number",
}

ADDRESS_FIELDS = (
    "region_code", "region_name", "province_code", "province_name",
    "city_municipality_code", "city_municipality_name", "barangay_code", "barangay_name",
    "street_address", "zip_code",
)


class EmployerCompany(BaseModel):
    __tablename__ = "employer_companies"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)

    # Basic Information
    company_name = db.Column(db.String(255), nullable=True)
    trade_name = db.Column(db.String(255), nullable=True)
    business_type = db.Column(db.String(30), nullable=True)
    industry = db.Column(db.String(150), nullable=True)
    nature_of_business = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)  # "About Company"
    year_established = db.Column(db.SmallInteger, nullable=True)
    num_employees = db.Column(db.Integer, nullable=True)
    company_size = db.Column(db.String(20), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    company_email = db.Column(db.String(255), nullable=True)
    contact_number = db.Column(db.String(30), nullable=True)
    alt_contact_number = db.Column(db.String(30), nullable=True)
    logo_url = db.Column(db.String(1000), nullable=True)

    # Business Registration
    business_permit_no = db.Column(db.String(150), nullable=True)
    bir_tin = db.Column(db.String(30), nullable=True)
    sec_number = db.Column(db.String(50), nullable=True)
    dti_number = db.Column(db.String(50), nullable=True)
    cda_number = db.Column(db.String(50), nullable=True)
    philgeps_registration_no = db.Column(db.String(50), nullable=True)

    # Company Address (legacy free-text `address` kept read-only for old records
    # that predate the cascading picker; new saves populate the structured fields)
    address = db.Column(db.String(500), nullable=True)
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

    # Company Representative
    rep_name = db.Column(db.String(255), nullable=True)
    rep_position = db.Column(db.String(150), nullable=True)
    rep_email = db.Column(db.String(255), nullable=True)
    rep_contact_number = db.Column(db.String(30), nullable=True)
    rep_gov_id_number = db.Column(db.String(100), nullable=True)
    rep_signature_url = db.Column(db.String(1000), nullable=True)

    # Employment Information
    hiring_status = db.Column(db.String(20), default="not_hiring", nullable=False)
    preferred_hiring_areas = db.Column(db.JSON, default=list)
    work_setup = db.Column(db.JSON, default=list)
    employment_types_offered = db.Column(db.JSON, default=list)

    # Social Media (optional)
    facebook_url = db.Column(db.String(255), nullable=True)
    linkedin_url = db.Column(db.String(255), nullable=True)
    instagram_url = db.Column(db.String(255), nullable=True)
    x_url = db.Column(db.String(255), nullable=True)

    # Accreditation
    accreditation_status = db.Column(db.String(20), default="not_submitted", nullable=False)
    accreditation_remarks = db.Column(db.Text, nullable=True)

    user = db.relationship("User", back_populates="employer_company")
    documents = db.relationship(
        "EmployerCompanyDocument", back_populates="company", cascade="all, delete-orphan",
        order_by="EmployerCompanyDocument.created_at.desc()",
    )

    __table_args__ = (
        db.CheckConstraint(f"accreditation_status IN {ACCREDITATION_STATUSES}", name="ck_employer_accreditation_status"),
        db.CheckConstraint(f"business_type IN {BUSINESS_TYPES}", name="ck_employer_business_type"),
        db.CheckConstraint(f"company_size IN {COMPANY_SIZES}", name="ck_employer_company_size"),
        db.CheckConstraint(f"hiring_status IN {HIRING_STATUSES}", name="ck_employer_hiring_status"),
    )

    def active_vacancies_count(self) -> int:
        from models.vacancy import Vacancy

        return Vacancy.query.filter_by(employer_company_id=self.id, status="published").count()

    def registration_number_field(self):
        """Which of sec_number/dti_number/cda_number applies to this company's business_type."""
        return BUSINESS_TYPE_REGISTRATION_FIELD.get(self.business_type)

    def to_dict(self, include_email=None):
        from services.profile_completion_service import COMPANY_REQUIRED_FIELDS, compute_completion

        completion = compute_completion(self, COMPANY_REQUIRED_FIELDS)
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "email": include_email,
            "company_name": self.company_name,
            "trade_name": self.trade_name,
            "business_type": self.business_type,
            "industry": self.industry,
            "nature_of_business": self.nature_of_business,
            "description": self.description,
            "year_established": self.year_established,
            "num_employees": self.num_employees,
            "company_size": self.company_size,
            "website": self.website,
            "company_email": self.company_email,
            "contact_number": self.contact_number,
            "alt_contact_number": self.alt_contact_number,
            "logo_url": self.logo_url,
            "business_permit_no": self.business_permit_no,
            "bir_tin": self.bir_tin,
            "sec_number": self.sec_number,
            "dti_number": self.dti_number,
            "cda_number": self.cda_number,
            "philgeps_registration_no": self.philgeps_registration_no,
            "address": self.address,
            "region_code": self.region_code,
            "region_name": self.region_name,
            "province_code": self.province_code,
            "province_name": self.province_name,
            "city_municipality_code": self.city_municipality_code,
            "city_municipality_name": self.city_municipality_name,
            "barangay_code": self.barangay_code,
            "barangay_name": self.barangay_name,
            "street_address": self.street_address,
            "zip_code": self.zip_code,
            "rep_name": self.rep_name,
            "rep_position": self.rep_position,
            "rep_email": self.rep_email,
            "rep_contact_number": self.rep_contact_number,
            "rep_gov_id_number": self.rep_gov_id_number,
            "rep_signature_url": self.rep_signature_url,
            "hiring_status": self.hiring_status,
            "preferred_hiring_areas": self.preferred_hiring_areas or [],
            "work_setup": self.work_setup or [],
            "employment_types_offered": self.employment_types_offered or [],
            "facebook_url": self.facebook_url,
            "linkedin_url": self.linkedin_url,
            "instagram_url": self.instagram_url,
            "x_url": self.x_url,
            "accreditation_status": self.accreditation_status,
            "accreditation_remarks": self.accreditation_remarks,
            "active_vacancies": self.active_vacancies_count(),
            "documents": [d.to_dict() for d in self.documents],
            "profile_completion": completion["profile_completion"],
            "completed_count": completion["completed_count"],
            "total_count": completion["total_count"],
            "missing_fields": completion["missing_fields"],
        }


class EmployerCompanyDocument(BaseModel):
    __tablename__ = "employer_company_documents"

    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id", ondelete="CASCADE"), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)
    file_url = db.Column(db.String(1000), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="pending_review", nullable=False)
    rejection_reason = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    company = db.relationship("EmployerCompany", back_populates="documents")

    __table_args__ = (
        db.CheckConstraint(f"document_type IN {COMPANY_DOCUMENT_TYPES}", name="ck_employer_company_document_type"),
        db.CheckConstraint(f"status IN {DOCUMENT_STATUSES}", name="ck_employer_company_document_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_type": self.document_type,
            "file_url": self.file_url,
            "original_filename": self.original_filename,
            "status": self.status,
            "rejection_reason": self.rejection_reason,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "uploaded_at": self.created_at.isoformat() if self.created_at else None,
        }
