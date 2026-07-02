import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

ENROLLMENT_STATUSES = ("enrolled", "waitlisted", "attended", "completed", "certificate_issued")


class TrainingProgram(BaseModel):
    __tablename__ = "training_programs"

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    trainer = db.Column(db.String(255), nullable=True)
    venue = db.Column(db.String(500), nullable=True)
    schedule = db.Column(db.DateTime(timezone=True), nullable=False)
    max_slots = db.Column(db.Integer, default=30)
    status = db.Column(db.String(20), default="open", nullable=False)  # open | ongoing | completed | archived
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    enrollments = db.relationship("TrainingEnrollment", back_populates="program", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "trainer": self.trainer,
            "venue": self.venue,
            "schedule": self.schedule.isoformat() if self.schedule else None,
            "max_slots": self.max_slots,
            "status": self.status,
            "enrolled_count": len(self.enrollments),
        }


class TrainingEnrollment(BaseModel):
    __tablename__ = "training_enrollments"

    program_id = db.Column(UUID(as_uuid=True), db.ForeignKey("training_programs.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    status = db.Column(db.String(20), default="enrolled", nullable=False)
    qr_token = db.Column(db.String(64), unique=True, default=lambda: uuid.uuid4().hex, nullable=False)
    certificate_url = db.Column(db.String(1000), nullable=True)

    program = db.relationship("TrainingProgram", back_populates="enrollments")
    jobseeker_profile = db.relationship("JobseekerProfile")

    __table_args__ = (
        db.UniqueConstraint("program_id", "jobseeker_profile_id", name="uq_training_jobseeker"),
        db.CheckConstraint(f"status IN {ENROLLMENT_STATUSES}", name="ck_enrollment_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "program_id": str(self.program_id),
            "program_title": self.program.title if self.program else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "status": self.status,
            "qr_token": self.qr_token,
            "certificate_url": self.certificate_url,
        }
