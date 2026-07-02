from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

VERIFICATION_STATUSES = ("unverified", "verified", "suspended")


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
        }
