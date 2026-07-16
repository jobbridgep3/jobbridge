import bcrypt

from extensions import db
from models.base import BaseModel

ROLES = ("jobseeker", "employer", "staff", "admin")


class User(BaseModel):
    __tablename__ = "users"

    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    is_verified = db.Column(db.Boolean, default=False, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    must_change_password = db.Column(db.Boolean, default=False, nullable=False)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)
    welcome_flow_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    theme_preference = db.Column(db.String(10), default="system", nullable=False)

    jobseeker_profile = db.relationship(
        "JobseekerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    employer_company = db.relationship(
        "EmployerCompany", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    employer_hr_profile = db.relationship(
        "EmployerHRProfile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (db.CheckConstraint(f"role IN {ROLES}", name="ck_users_role"),)

    def set_password(self, plaintext: str):
        self.password_hash = bcrypt.hashpw(plaintext.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

    def check_password(self, plaintext: str) -> bool:
        return bcrypt.checkpw(plaintext.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self):
        return {
            "id": str(self.id),
            "email": self.email,
            "role": self.role,
            "is_verified": self.is_verified,
            "is_active": self.is_active,
            "must_change_password": self.must_change_password,
            "theme_preference": self.theme_preference,
            "profile_picture_url": (
                self.jobseeker_profile.profile_picture_url if self.jobseeker_profile
                else self.employer_hr_profile.profile_picture_url if self.employer_hr_profile
                else None
            ),
        }
