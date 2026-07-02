import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from utils.timezone import now_manila


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = db.Column(db.DateTime(timezone=True), default=now_manila, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_manila, onupdate=now_manila, nullable=False)

    def save(self):
        db.session.add(self)
        db.session.commit()
        return self

    def delete(self):
        db.session.delete(self)
        db.session.commit()
