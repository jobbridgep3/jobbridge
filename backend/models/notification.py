from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class Notification(BaseModel):
    __tablename__ = "notifications"

    # CASCADE on delete: a notification is meaningless without the user whose inbox
    # it belongs to, so it should be deleted along with the account, not block deletion.
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=True)
    link = db.Column(db.String(500), nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    is_archived = db.Column(db.Boolean, default=False, nullable=False)
    priority = db.Column(db.String(10), nullable=True)  # normal|important|urgent — NULL falls back to the
    # frontend's per-type TYPE_PRIORITY_MAP; only set explicitly by callers with a real reason to (e.g.
    # announcement-sourced notifications inherit the announcement's own priority).

    def to_dict(self):
        return {
            "id": str(self.id),
            "type": self.type,
            "title": self.title,
            "message": self.message,
            "link": self.link,
            "is_read": self.is_read,
            "is_archived": self.is_archived,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
