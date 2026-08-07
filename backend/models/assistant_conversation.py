from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class AssistantConversation(BaseModel):
    """Chat conversation persistence for the AI assistant (post-launch Feature 4).

    Deliberately one table with a JSON messages blob, not a normalized per-message
    table — matches this app's existing JSON-column convention (Announcement's
    gallery_images, ProgramApplication's form_data, AuditTrail's before_state/
    after_state are all db.JSON on Postgres already), and the access pattern here
    (load-the-whole-conversation, list summaries) doesn't need per-message rows.

    Scoped strictly per user — ownership is re-checked on every read/write in
    blueprints/assistant.py, the same defensive pattern every other user-owned
    resource in this app already follows. Public/anonymous visitors never get a row
    here — there's no account to scope one to.

    messages entries: {"role": "user"|"assistant", "content": str, "attachment"?: str}
    — "attachment" is an optional short label (e.g. "photo", a filename) for display
    only, never the file itself; uploaded files are never persisted (unchanged since
    Phase 4's document-upload design).
    """

    __tablename__ = "assistant_conversations"

    # CASCADE on delete: a conversation is meaningless without the account it belongs
    # to, so it should be deleted along with the account, not block deletion — same
    # reasoning as Notification.user_id.
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    messages = db.Column(db.JSON, nullable=False, default=list)
    is_pinned = db.Column(db.Boolean, default=False, nullable=False)
    is_favorite = db.Column(db.Boolean, default=False, nullable=False)
    last_message_at = db.Column(db.DateTime(timezone=True), nullable=False)

    def to_summary_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "is_pinned": self.is_pinned,
            "is_favorite": self.is_favorite,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_dict(self):
        data = self.to_summary_dict()
        data["messages"] = self.messages or []
        return data
