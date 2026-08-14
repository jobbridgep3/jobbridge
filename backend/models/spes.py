import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

SPES_BATCH_STATUSES = ("open", "closed", "archived")

# Orientation and Exam are fully symmetric: QR attendance scanning automatically
# advances an applicant from "approved/eligible" to "attended" (no manual attendance
# step), and Staff then records a separate pass/fail decision on the Outcomes screen.
# There is no Deployment/DTR tracking — PESO coordinates placement in person once an
# applicant passes; the system's involvement ends with a PESO-office appointment
# (see SpesApplication.peso_appointment_at).
#   approved_for_orientation -> [QR scan] -> attended_orientation -> [Staff result] -> orientation_passed | failed_orientation
#   orientation_passed -> [QR scan] -> attended_exam -> [Staff result] -> passed | failed
#   passed -> [Staff sets PESO appointment] -> passed (peso_appointment_at populated)
SPES_APPLICATION_STATUSES = (
    "pending_review", "rejected", "approved_for_orientation", "attended_orientation",
    "orientation_passed", "failed_orientation", "attended_exam", "passed", "failed",
)
SPES_ATTENDANCE_EVENT_TYPES = ("orientation", "exam")


class SpesBatch(BaseModel):
    """A SPES cohort/cycle — batch-level fields (slots, budget, requirements, per-batch
    GWA/income thresholds) plus independent orientation and exam schedule sub-sections,
    each with its own date/venue/dress-code, per the spec's "fully independent
    everywhere" requirement."""

    __tablename__ = "spes_batches"

    batch_name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    open_date = db.Column(db.Date, nullable=False)
    registration_deadline = db.Column(db.Date, nullable=False)
    total_slots = db.Column(db.Integer, nullable=False)
    budget_allocation = db.Column(db.Numeric(14, 2), nullable=True)  # reference figure only, see spes_reporting_service
    requirements = db.Column(db.JSON, default=list)  # editable checklist, list of strings
    min_gwa = db.Column(db.Numeric(5, 2), nullable=True)  # per-batch eligibility threshold; null = no GWA gate
    max_family_income = db.Column(db.Numeric(12, 2), nullable=True)  # per-batch threshold; null = no income gate
    status = db.Column(db.String(20), default="open", nullable=False)

    orientation_at = db.Column(db.DateTime(timezone=True), nullable=True)
    orientation_venue = db.Column(db.String(500), nullable=True)
    orientation_dress_code = db.Column(db.JSON, nullable=True)  # {"top": [...], "bottom": [...], "footwear": [...]}
    orientation_notice_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)

    exam_at = db.Column(db.DateTime(timezone=True), nullable=True)
    exam_venue = db.Column(db.String(500), nullable=True)
    exam_dress_code = db.Column(db.JSON, nullable=True)
    exam_notice_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)

    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    closed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    applications = db.relationship("SpesApplication", back_populates="batch")

    __table_args__ = (
        db.CheckConstraint(f"status IN {SPES_BATCH_STATUSES}", name="ck_spes_batch_status"),
    )

    def to_dict(self):
        current_applicants = len([a for a in self.applications if a.status != "rejected"])
        slots_remaining = max(self.total_slots - current_applicants, 0)
        return {
            "id": str(self.id),
            "batch_name": self.batch_name,
            "description": self.description,
            "open_date": self.open_date.isoformat() if self.open_date else None,
            "registration_deadline": self.registration_deadline.isoformat() if self.registration_deadline else None,
            "total_slots": self.total_slots,
            "current_applicants": current_applicants,
            "slots_remaining": slots_remaining,
            "is_full": slots_remaining <= 0,
            "budget_allocation": float(self.budget_allocation) if self.budget_allocation is not None else None,
            "requirements": self.requirements or [],
            "min_gwa": float(self.min_gwa) if self.min_gwa is not None else None,
            "max_family_income": float(self.max_family_income) if self.max_family_income is not None else None,
            "status": self.status,
            "orientation_at": self.orientation_at.isoformat() if self.orientation_at else None,
            "orientation_venue": self.orientation_venue,
            "orientation_dress_code": self.orientation_dress_code,
            "orientation_notice_sent_at": self.orientation_notice_sent_at.isoformat() if self.orientation_notice_sent_at else None,
            "exam_at": self.exam_at.isoformat() if self.exam_at else None,
            "exam_venue": self.exam_venue,
            "exam_dress_code": self.exam_dress_code,
            "exam_notice_sent_at": self.exam_notice_sent_at.isoformat() if self.exam_notice_sent_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SpesApplication(BaseModel):
    """A jobseeker's registration into one SPES batch. Personal/eligibility fields are
    snapshotted at submission time (school_name/year_level stay editable by re-submission
    is not supported — see uq_spes_batch_jobseeker) so later profile edits don't silently
    change what was declared and validated at registration."""

    __tablename__ = "spes_applications"

    batch_id = db.Column(UUID(as_uuid=True), db.ForeignKey("spes_batches.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    application_ref_no = db.Column(db.String(30), unique=True, nullable=False)
    qr_token = db.Column(db.String(64), unique=True, default=lambda: uuid.uuid4().hex, nullable=False)
    status = db.Column(db.String(30), default="pending_review", nullable=False)

    full_name = db.Column(db.String(255), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    age = db.Column(db.Integer, nullable=False)
    school_name = db.Column(db.String(255), nullable=False)
    year_level = db.Column(db.String(50), nullable=False)
    family_income = db.Column(db.Numeric(12, 2), nullable=False)
    gwa = db.Column(db.Numeric(5, 2), nullable=False)
    document_urls = db.Column(db.JSON, default=list)
    application_form_pdf_url = db.Column(db.String(1000), nullable=True)

    review_remarks = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    orientation_outcome_remarks = db.Column(db.Text, nullable=True)
    orientation_outcome_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    orientation_outcome_at = db.Column(db.DateTime(timezone=True), nullable=True)

    exam_result_remarks = db.Column(db.Text, nullable=True)
    exam_result_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    exam_result_at = db.Column(db.DateTime(timezone=True), nullable=True)

    peso_appointment_at = db.Column(db.DateTime(timezone=True), nullable=True)  # set by Staff once status='passed'

    submitted_at = db.Column(db.DateTime(timezone=True), nullable=False)

    batch = db.relationship("SpesBatch", back_populates="applications")
    jobseeker_profile = db.relationship("JobseekerProfile")
    attendance_logs = db.relationship("SpesAttendanceLog", back_populates="application", cascade="all, delete-orphan")

    __table_args__ = (
        db.CheckConstraint(f"status IN {SPES_APPLICATION_STATUSES}", name="ck_spes_application_status"),
        db.UniqueConstraint("batch_id", "jobseeker_profile_id", name="uq_spes_batch_jobseeker"),
    )

    def to_dict(self, include_attendance=False):
        data = {
            "id": str(self.id),
            "batch_id": str(self.batch_id),
            "batch_name": self.batch.batch_name if self.batch else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_email": self.jobseeker_profile.user.email if self.jobseeker_profile and self.jobseeker_profile.user else None,
            "application_ref_no": self.application_ref_no,
            "qr_token": self.qr_token,
            "status": self.status,
            "full_name": self.full_name,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.age,
            "school_name": self.school_name,
            "year_level": self.year_level,
            "family_income": float(self.family_income) if self.family_income is not None else None,
            "gwa": float(self.gwa) if self.gwa is not None else None,
            "document_urls": self.document_urls or [],
            "application_form_pdf_url": self.application_form_pdf_url,
            "review_remarks": self.review_remarks,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "orientation_outcome_remarks": self.orientation_outcome_remarks,
            "orientation_outcome_at": self.orientation_outcome_at.isoformat() if self.orientation_outcome_at else None,
            "exam_result_remarks": self.exam_result_remarks,
            "exam_result_at": self.exam_result_at.isoformat() if self.exam_result_at else None,
            "peso_appointment_at": self.peso_appointment_at.isoformat() if self.peso_appointment_at else None,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_attendance:
            data["attendance_logs"] = [a.to_dict() for a in self.attendance_logs]
        return data


class SpesAttendanceLog(BaseModel):
    """One row per (application, event_type) — orientation and exam attendance are
    always logged separately, never combined or inferred from one another."""

    __tablename__ = "spes_attendance_logs"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("spes_applications.id"), nullable=False)
    event_type = db.Column(db.String(20), nullable=False)
    scanned_at = db.Column(db.DateTime(timezone=True), nullable=False)
    scanned_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    application = db.relationship("SpesApplication", back_populates="attendance_logs")

    __table_args__ = (
        db.CheckConstraint(f"event_type IN {SPES_ATTENDANCE_EVENT_TYPES}", name="ck_spes_attendance_event_type"),
        db.UniqueConstraint("application_id", "event_type", name="uq_spes_attendance_event"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "event_type": self.event_type,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
        }
