from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

INTERVIEW_STATUSES = ("pending", "accepted", "declined", "completed", "cancelled", "rescheduled")
INTERVIEW_RESULTS = ("pending", "passed", "failed", "shortlisted", "hired")
RESCHEDULE_REQUEST_STATUSES = ("pending", "approved", "rejected", "suggested", "superseded")


class Interview(BaseModel):
    __tablename__ = "interviews"

    application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("applications.id"), nullable=False)
    scheduled_date = db.Column(db.DateTime(timezone=True), nullable=False)
    mode = db.Column(db.String(20), nullable=False, default="onsite")  # onsite | online
    location = db.Column(db.String(500), nullable=True)  # physical venue (legacy rows may hold a link)
    meeting_link = db.Column(db.String(1000), nullable=True)  # online meeting URL
    interviewer_name = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="pending", nullable=False)
    result = db.Column(db.String(20), default="pending", nullable=False)
    score = db.Column(db.SmallInteger, nullable=True)  # 0-100
    notes = db.Column(db.Text, nullable=True)  # internal, employer-only
    decline_reason = db.Column(db.Text, nullable=True)
    reminder_sent_at = db.Column(db.DateTime(timezone=True), nullable=True)

    application = db.relationship("Application", back_populates="interviews")
    reschedule_requests = db.relationship(
        "InterviewRescheduleRequest", back_populates="interview",
        cascade="all, delete-orphan", order_by="InterviewRescheduleRequest.created_at",
    )

    __table_args__ = (
        db.CheckConstraint(f"status IN {INTERVIEW_STATUSES}", name="ck_interview_status"),
        db.CheckConstraint(f"result IN {INTERVIEW_RESULTS}", name="ck_interview_result"),
    )

    def to_dict(self, include_notes=True):
        app = self.application
        vacancy = app.vacancy if app else None
        pending_request = next((r for r in self.reschedule_requests if r.status == "pending"), None)
        data = {
            "id": str(self.id),
            "application_id": str(self.application_id),
            "job_title": vacancy.title if vacancy else None,
            "company_name": vacancy.employer_company.company_name if vacancy and vacancy.employer_company else None,
            "jobseeker_name": app.jobseeker_profile.full_name if app and app.jobseeker_profile else None,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "mode": self.mode,
            "location": self.location,
            "meeting_link": self.meeting_link,
            "interviewer_name": self.interviewer_name,
            "status": self.status,
            "result": self.result,
            "score": self.score,
            "decline_reason": self.decline_reason,
            "pending_reschedule_request": pending_request.to_dict() if pending_request else None,
        }
        if include_notes:
            data["notes"] = self.notes
        return data


class InterviewRescheduleRequest(BaseModel):
    __tablename__ = "interview_reschedule_requests"

    interview_id = db.Column(UUID(as_uuid=True), db.ForeignKey("interviews.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    preferred_date = db.Column(db.DateTime(timezone=True), nullable=False)
    reason = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="pending", nullable=False)
    responded_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    response_note = db.Column(db.Text, nullable=True)
    suggested_date = db.Column(db.DateTime(timezone=True), nullable=True)  # set when status = suggested

    interview = db.relationship("Interview", back_populates="reschedule_requests")

    __table_args__ = (
        db.CheckConstraint(f"status IN {RESCHEDULE_REQUEST_STATUSES}", name="ck_reschedule_request_status"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "interview_id": str(self.interview_id),
            "preferred_date": self.preferred_date.isoformat() if self.preferred_date else None,
            "reason": self.reason,
            "status": self.status,
            "response_note": self.response_note,
            "suggested_date": self.suggested_date.isoformat() if self.suggested_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
