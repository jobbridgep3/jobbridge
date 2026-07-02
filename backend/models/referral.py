from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class ReferralLetter(BaseModel):
    __tablename__ = "referral_letters"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), unique=True, nullable=False)
    generated_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    pdf_url = db.Column(db.String(1000), nullable=False)

    application = db.relationship("Application", back_populates="referral_letter")

    def to_dict(self):
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "pdf_url": self.pdf_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
