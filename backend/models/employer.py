from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

VERIFICATION_STATUSES = ("unverified", "verified", "suspended")

# Document types a company may submit — mandatory set (enforced in Phase 1's
# profile-completion/accreditation-submit gate, not a DB constraint) is
# business_permit, business_registration_certificate, bir_registration, company_logo.
COMPANY_DOCUMENT_TYPES = (
    "business_permit", "business_registration_certificate", "bir_registration", "company_logo",
    "philgeps", "mayors_permit", "dole_registration", "peza_certificate", "accreditation_certificate",
    "iso_certificate", "safety_certificate", "rep_gov_id", "authorization_letter", "company_id",
)
DOCUMENT_STATUSES = ("pending_review", "verified", "rejected")


class EmployerCompany(BaseModel):
    __tablename__ = "employer_companies"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), unique=True, nullable=False)
    hr_contact_name = db.Column(db.String(255), nullable=False, default="")
    contact_number = db.Column(db.String(30), nullable=True)
    company_name = db.Column(db.String(255), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    industry = db.Column(db.String(150), nullable=True)
    business_permit_no = db.Column(db.String(150), nullable=True)
    description = db.Column(db.Text, nullable=True)
    website = db.Column(db.String(255), nullable=True)
    logo_url = db.Column(db.String(1000), nullable=True)
    document_urls = db.Column(db.JSON, default=list)
    verification_status = db.Column(db.String(20), default="unverified", nullable=False)
    verification_remarks = db.Column(db.Text, nullable=True)

    user = db.relationship("User", back_populates="employer_company")
    documents = db.relationship(
        "EmployerCompanyDocument", back_populates="company", cascade="all, delete-orphan",
        order_by="EmployerCompanyDocument.created_at.desc()",
    )

    __table_args__ = (
        db.CheckConstraint(f"verification_status IN {VERIFICATION_STATUSES}", name="ck_employer_verification_status"),
    )

    def to_dict(self, include_email=None):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "email": include_email,
            "hr_contact_name": self.hr_contact_name,
            "contact_number": self.contact_number,
            "company_name": self.company_name,
            "address": self.address,
            "industry": self.industry,
            "business_permit_no": self.business_permit_no,
            "description": self.description,
            "website": self.website,
            "logo_url": self.logo_url,
            "document_urls": self.document_urls or [],
            "verification_status": self.verification_status,
            "verification_remarks": self.verification_remarks,
            "documents": [d.to_dict() for d in self.documents],
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
