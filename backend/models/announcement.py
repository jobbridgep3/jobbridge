from sqlalchemy.dialects.postgresql import JSONB, UUID

from extensions import db
from models.base import BaseModel

CATEGORIES = (
    "general", "job_fair", "training", "spes", "owwa", "dilp",
    "manpower_skills_training", "system_update", "others",
)
PRIORITIES = ("normal", "important", "urgent")
STATUSES = ("draft", "published", "archived")
TARGET_ROLES = ("public", "jobseeker", "employer", "staff", "admin")


class Announcement(BaseModel):
    __tablename__ = "announcements"

    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(40), default="general", nullable=False)
    priority = db.Column(db.String(10), default="normal", nullable=False)
    banner_url = db.Column(db.String(500), nullable=True)
    gallery_images = db.Column(db.JSON, default=list)  # [{"name": ..., "url": ...}]
    pdf_url = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(10), default="draft", nullable=False)
    # JSONB (not plain JSON) — required for Postgres's @> containment operator,
    # which _visible_query() uses to check "is `role` one of this row's
    # target_roles"; a generic JSON column's .contains() silently compiles to
    # a substring LIKE match instead and would never match correctly.
    target_roles = db.Column(JSONB, default=lambda: list(TARGET_ROLES), nullable=False)
    is_pinned = db.Column(db.Boolean, default=False)  # admin-only critical pin
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    scheduled_publish_at = db.Column(db.DateTime(timezone=True), nullable=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    reach_count = db.Column(db.Integer, default=0)

    author = db.relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        db.CheckConstraint(f"category IN {CATEGORIES}", name="ck_announcement_category"),
        db.CheckConstraint(f"priority IN {PRIORITIES}", name="ck_announcement_priority"),
        db.CheckConstraint(f"status IN {STATUSES}", name="ck_announcement_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "body": self.body,
            "category": self.category,
            "priority": self.priority,
            "banner_url": self.banner_url,
            "gallery_images": self.gallery_images or [],
            "pdf_url": self.pdf_url,
            "status": self.status,
            "target_roles": self.target_roles or [],
            "is_pinned": self.is_pinned,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "scheduled_publish_at": self.scheduled_publish_at.isoformat() if self.scheduled_publish_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "reach_count": self.reach_count,
            "author_name": self.author.email if self.author else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
