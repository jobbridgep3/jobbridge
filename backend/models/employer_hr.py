from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

CIVIL_STATUSES = ("Single", "Married", "Widowed", "Separated", "Divorced")
EMPLOYMENT_STATUSES = ("regular", "probationary", "contractual", "part_time")
HR_ROLES = ("hr_officer", "hr_manager", "recruiter", "owner", "admin_staff")

HR_DOCUMENT_TYPES = ("government_id", "company_id", "authorization_letter", "prc_license", "hr_certificate", "digital_signature")
HR_MANDATORY_DOCUMENT_TYPES = ("government_id", "company_id", "authorization_letter")
HR_DOCUMENT_STATUSES = ("pending_review", "verified", "rejected")


class EmployerHRProfile(BaseModel):
    """The logged-in HR/employer user's own personal profile — distinct from
    EmployerCompany (the company's official listing). 1:1 with User; also carries a
    denormalized employer_company_id for direct joins/reporting without needing to
    go through User every time."""

    __tablename__ = "employer_hr_profiles"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id", ondelete="CASCADE"), nullable=False)

    # Personal
    profile_picture_url = db.Column(db.String(1000), nullable=True)
    full_name = db.Column(db.String(255), nullable=False, default="")
    gender = db.Column(db.String(20), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    civil_status = db.Column(db.String(30), nullable=True)
    nationality = db.Column(db.String(100), nullable=True, default="Filipino")

    # Contact (company email = the User's login email, read via `user`; not duplicated here)
    personal_email = db.Column(db.String(255), nullable=True)
    mobile_number = db.Column(db.String(30), nullable=True)
    telephone_number = db.Column(db.String(30), nullable=True)

    # Employment (company_name is read via `company`)
    employee_id = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(150), nullable=True)
    position = db.Column(db.String(150), nullable=True)
    employment_status = db.Column(db.String(30), nullable=True)
    hr_role = db.Column(db.String(30), nullable=True)

    # Address (same flat-column pattern as EmployerCompany/Vacancy)
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

    # Emergency Contact (optional)
    emergency_contact_name = db.Column(db.String(255), nullable=True)
    emergency_contact_relationship = db.Column(db.String(100), nullable=True)
    emergency_contact_number = db.Column(db.String(30), nullable=True)

    user = db.relationship("User", back_populates="employer_hr_profile")
    company = db.relationship("EmployerCompany")
    documents = db.relationship(
        "EmployerHRDocument", back_populates="profile", cascade="all, delete-orphan",
        order_by="EmployerHRDocument.created_at.desc()",
    )

    __table_args__ = (
        db.CheckConstraint(f"civil_status IN {CIVIL_STATUSES}", name="ck_employer_hr_civil_status"),
        db.CheckConstraint(f"employment_status IN {EMPLOYMENT_STATUSES}", name="ck_employer_hr_employment_status"),
        db.CheckConstraint(f"hr_role IN {HR_ROLES}", name="ck_employer_hr_role"),
    )

    def to_dict(self, include_email=None):
        from services.profile_completion_service import HR_REQUIRED_FIELDS, compute_completion

        completion = compute_completion(self, HR_REQUIRED_FIELDS)
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "email": include_email,
            "company_name": self.company.company_name if self.company else None,
            "profile_picture_url": self.profile_picture_url,
            "full_name": self.full_name,
            "gender": self.gender,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "civil_status": self.civil_status,
            "nationality": self.nationality,
            "personal_email": self.personal_email,
            "mobile_number": self.mobile_number,
            "telephone_number": self.telephone_number,
            "employee_id": self.employee_id,
            "department": self.department,
            "position": self.position,
            "employment_status": self.employment_status,
            "hr_role": self.hr_role,
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
            "emergency_contact_name": self.emergency_contact_name,
            "emergency_contact_relationship": self.emergency_contact_relationship,
            "emergency_contact_number": self.emergency_contact_number,
            "documents": [d.to_dict() for d in self.documents],
            "profile_completion": completion["profile_completion"],
            "completed_count": completion["completed_count"],
            "total_count": completion["total_count"],
            "missing_fields": completion["missing_fields"],
        }


class EmployerHRDocument(BaseModel):
    __tablename__ = "employer_hr_documents"

    employer_hr_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_hr_profiles.id", ondelete="CASCADE"), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)
    file_url = db.Column(db.String(1000), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="pending_review", nullable=False)
    rejection_reason = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    profile = db.relationship("EmployerHRProfile", back_populates="documents")

    __table_args__ = (
        db.CheckConstraint(f"document_type IN {HR_DOCUMENT_TYPES}", name="ck_employer_hr_document_type"),
        db.CheckConstraint(f"status IN {HR_DOCUMENT_STATUSES}", name="ck_employer_hr_document_status"),
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
