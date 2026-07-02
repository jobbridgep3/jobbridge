from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel


class OtpCode(BaseModel):
    __tablename__ = "otp_codes"

    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    purpose = db.Column(db.String(30), nullable=False, default="register")  # register | reset_password
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User")
