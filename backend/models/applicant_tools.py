"""Application-scoped recruitment tools: employer<->jobseeker messages, additional
document requests, and job offers."""

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

DOCUMENT_REQUEST_STATUSES = ("pending", "submitted", "cancelled")
JOB_OFFER_STATUSES = ("offered", "accepted", "declined", "withdrawn")


class ApplicationMessage(BaseModel):
    __tablename__ = "application_messages"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = db.Column(db.Text, nullable=False)
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)

    application = db.relationship("Application", backref=db.backref("messages", cascade="all, delete-orphan", order_by="ApplicationMessage.created_at"))
    sender = db.relationship("User")

    def to_dict(self):
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "sender_role": self.sender.role if self.sender else None,
            "body": self.body,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DocumentRequest(BaseModel):
    __tablename__ = "document_requests"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    document_label = db.Column(db.String(255), nullable=False)
    note = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="pending", nullable=False)
    submitted_document_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_documents.id", ondelete="SET NULL"), nullable=True)
    submitted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    application = db.relationship("Application", backref=db.backref("document_requests", cascade="all, delete-orphan", order_by="DocumentRequest.created_at"))
    submitted_document = db.relationship("JobseekerDocument")

    __table_args__ = (db.CheckConstraint(f"status IN {DOCUMENT_REQUEST_STATUSES}", name="ck_document_request_status"),)

    def to_dict(self):
        doc = self.submitted_document
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "document_label": self.document_label,
            "note": self.note,
            "status": self.status,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "submitted_document": {"id": str(doc.id), "file_url": doc.file_url, "original_filename": doc.original_filename} if doc else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class JobOffer(BaseModel):
    __tablename__ = "job_offers"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False)
    position = db.Column(db.String(255), nullable=False)
    salary_offer = db.Column(db.Numeric(12, 2), nullable=True)
    employment_type = db.Column(db.String(30), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    terms = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="offered", nullable=False)
    pdf_url = db.Column(db.String(1000), nullable=True)
    responded_at = db.Column(db.DateTime(timezone=True), nullable=True)

    application = db.relationship("Application", backref=db.backref("job_offer", uselist=False, cascade="all, delete-orphan"))

    __table_args__ = (db.CheckConstraint(f"status IN {JOB_OFFER_STATUSES}", name="ck_job_offer_status"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "position": self.position,
            "salary_offer": float(self.salary_offer) if self.salary_offer is not None else None,
            "employment_type": self.employment_type,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "terms": self.terms,
            "status": self.status,
            "pdf_url": self.pdf_url,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
