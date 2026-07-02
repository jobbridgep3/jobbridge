from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class AuditTrail(BaseModel):
    """Immutable, append-only. No update/delete routes are ever exposed for this model."""

    __tablename__ = "audit_trail"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    user_email = db.Column(db.String(255), nullable=True)
    user_role = db.Column(db.String(20), nullable=True)
    action = db.Column(db.String(50), nullable=False)  # Login, Create, Update, Delete, Approve, Reject, Export, Generate...
    module = db.Column(db.String(100), nullable=False)
    record_id = db.Column(db.String(100), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    details = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id else None,
            "user_email": self.user_email,
            "user_role": self.user_role,
            "action": self.action,
            "module": self.module,
            "record_id": self.record_id,
            "ip_address": self.ip_address,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
