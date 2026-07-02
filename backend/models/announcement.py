from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

TARGET_AUDIENCES = ("all", "jobseekers", "employers")


class Announcement(BaseModel):
    __tablename__ = "announcements"

    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    target_audience = db.Column(db.String(20), default="all", nullable=False)
    is_pinned = db.Column(db.Boolean, default=False)  # admin-only critical pin
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    reach_count = db.Column(db.Integer, default=0)

    __table_args__ = (db.CheckConstraint(f"target_audience IN {TARGET_AUDIENCES}", name="ck_announcement_target"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "body": self.body,
            "target_audience": self.target_audience,
            "is_pinned": self.is_pinned,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "reach_count": self.reach_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
