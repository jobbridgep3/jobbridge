from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

OWWA_REQUEST_STATUSES = ("pending", "verified", "submitted_to_owwa", "for_owwa_response", "completed", "declined")
OWWA_DOCUMENT_TYPES = ("application_form", "supporting_document")


class OwwaRequest(BaseModel):
    """OWWA Assistance Program request — PESO Staff verifies eligibility (offline, via the
    OWWA Hotline), submits to OWWA Region IV-A (offline), and follows up until OWWA responds.
    Actual OWWA eligibility determination, benefit computation, and disbursement stay fully
    offline/manual at OWWA Region IV-A — this module only tracks the referral pipeline.

    Standalone from models/program.py's shared SPES/DILP/OWWA ProgramApplication — this
    module's status lifecycle doesn't fit that shared enum, so SPES/DILP stay on the
    existing generic system untouched."""

    __tablename__ = "owwa_requests"

    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    status = db.Column(db.String(20), default="pending", nullable=False)
    ofw_relationship = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    staff_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    verified_at = db.Column(db.DateTime(timezone=True), nullable=True)
    submitted_to_owwa_at = db.Column(db.DateTime(timezone=True), nullable=True)
    for_owwa_response_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    declined_at = db.Column(db.DateTime(timezone=True), nullable=True)
    declined_reason = db.Column(db.Text, nullable=True)

    jobseeker_profile = db.relationship("JobseekerProfile")
    documents = db.relationship("OwwaRequestDocument", back_populates="request", order_by="OwwaRequestDocument.created_at")
    remarks = db.relationship("OwwaRequestRemark", back_populates="request", order_by="OwwaRequestRemark.created_at")

    __table_args__ = (
        db.CheckConstraint(f"status IN {OWWA_REQUEST_STATUSES}", name="ck_owwa_request_status"),
    )

    def to_dict(self, include_documents=False, include_remarks=False):
        data = {
            "id": str(self.id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "status": self.status,
            "ofw_relationship": self.ofw_relationship,
            "notes": self.notes,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "submitted_to_owwa_at": self.submitted_to_owwa_at.isoformat() if self.submitted_to_owwa_at else None,
            "for_owwa_response_at": self.for_owwa_response_at.isoformat() if self.for_owwa_response_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "declined_at": self.declined_at.isoformat() if self.declined_at else None,
            "declined_reason": self.declined_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_documents:
            data["documents"] = [d.to_dict() for d in self.documents]
        if include_remarks:
            data["remarks"] = [r.to_dict() for r in self.remarks]
        return data


class OwwaRequestDocument(BaseModel):
    __tablename__ = "owwa_request_documents"

    owwa_request_id = db.Column(UUID(as_uuid=True), db.ForeignKey("owwa_requests.id", ondelete="CASCADE"), nullable=False)
    document_type = db.Column(db.String(50), nullable=False)
    file_url = db.Column(db.String(1000), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)

    request = db.relationship("OwwaRequest", back_populates="documents")

    __table_args__ = (
        db.CheckConstraint(f"document_type IN {OWWA_DOCUMENT_TYPES}", name="ck_owwa_document_type"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_type": self.document_type,
            "file_url": self.file_url,
            "original_filename": self.original_filename,
            "uploaded_at": self.created_at.isoformat() if self.created_at else None,
        }


class OwwaRequestRemark(BaseModel):
    __tablename__ = "owwa_request_remarks"

    owwa_request_id = db.Column(UUID(as_uuid=True), db.ForeignKey("owwa_requests.id", ondelete="CASCADE"), nullable=False)
    staff_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    remark = db.Column(db.Text, nullable=False)

    request = db.relationship("OwwaRequest", back_populates="remarks")
    staff = db.relationship("User")

    def to_dict(self):
        return {
            "id": str(self.id),
            "staff_id": str(self.staff_id),
            "staff_name": self.staff.email if self.staff else None,
            "remark": self.remark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
