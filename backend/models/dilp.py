from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel

DILP_STATUSES = ("pending", "scheduled", "completed", "no_show", "ready_for_claiming", "approved", "submitted_to_esfo")


class DilpApplication(BaseModel):
    """DOLE Integrated Livelihood Program module — jobseeker submits a livelihood proposal,
    PESO Staff assigns an interview, records the outcome, and drives every remaining stage
    through to ESFO submission. No jobseeker action is required after submission; the
    jobseeker only receives notifications and attends the interview / claims the document
    in person.

    Standalone from models/program.py's shared SPES/DILP/OWWA ProgramApplication — DILP's
    7-status lifecycle (pending/scheduled/completed/no_show/ready_for_claiming/approved/
    submitted_to_esfo) doesn't fit that shared enum, so this module graduates off it the
    same way SPES and OWWA already did. Old program_applications rows with
    program_type='dilp' are left in place, untouched.

    Admin has read-only visibility only — every status-mutating action is staff-only."""

    __tablename__ = "dilp_applications"

    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    status = db.Column(db.String(30), default="pending", nullable=False)

    proposed_livelihood = db.Column(db.String(255), nullable=False)
    business_description = db.Column(db.Text, nullable=False)
    capital_needed = db.Column(db.Numeric(12, 2), nullable=False)

    staff_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    # Current/latest scheduled interview datetime (Manila-aware, written via parse_manila).
    # Overwritten on every schedule/reschedule — the full history of every pass, including
    # every no_show -> scheduled loop, lives in DilpStatusHistory, not here.
    interview_at = db.Column(db.DateTime(timezone=True), nullable=True)
    no_show_count = db.Column(db.Integer, default=0, nullable=False)

    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    ready_for_claiming_at = db.Column(db.DateTime(timezone=True), nullable=True)
    approved_at = db.Column(db.DateTime(timezone=True), nullable=True)
    submitted_to_esfo_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobseeker_profile = db.relationship("JobseekerProfile")
    documents = db.relationship(
        "DilpApplicationDocument", back_populates="application",
        cascade="all, delete-orphan", order_by="DilpApplicationDocument.created_at",
    )
    remarks = db.relationship(
        "DilpApplicationRemark", back_populates="application",
        cascade="all, delete-orphan", order_by="DilpApplicationRemark.created_at",
    )
    status_history = db.relationship(
        "DilpStatusHistory", back_populates="application",
        cascade="all, delete-orphan", order_by="DilpStatusHistory.created_at",
    )

    __table_args__ = (
        db.CheckConstraint(f"status IN {DILP_STATUSES}", name="ck_dilp_application_status"),
    )

    def to_dict(self, include_documents=False, include_remarks=False, include_history=False):
        data = {
            "id": str(self.id),
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "jobseeker_contact": self.jobseeker_profile.contact_number if self.jobseeker_profile else None,
            "jobseeker_address": self.jobseeker_profile.to_dict().get("address") if self.jobseeker_profile else None,
            "jobseeker_email": self.jobseeker_profile.user.email if self.jobseeker_profile and self.jobseeker_profile.user else None,
            "status": self.status,
            "proposed_livelihood": self.proposed_livelihood,
            "business_description": self.business_description,
            "capital_needed": float(self.capital_needed) if self.capital_needed is not None else None,
            "interview_at": self.interview_at.isoformat() if self.interview_at else None,
            "no_show_count": self.no_show_count,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "ready_for_claiming_at": self.ready_for_claiming_at.isoformat() if self.ready_for_claiming_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "submitted_to_esfo_at": self.submitted_to_esfo_at.isoformat() if self.submitted_to_esfo_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_documents:
            data["documents"] = [d.to_dict() for d in self.documents]
        if include_remarks:
            data["remarks"] = [r.to_dict() for r in self.remarks]
        if include_history:
            data["history"] = [h.to_dict() for h in self.status_history]
        return data


class DilpApplicationDocument(BaseModel):
    """A single optional uploaded supporting document (e.g. a printed proposal) — one
    implicit type, unlike OWWA's two-type model, since the spec calls for one optional
    upload slot. ocr_text is populated the same way programs.py's old upload_program_docs
    did, for staff's benefit when reviewing an uploaded printed proposal."""

    __tablename__ = "dilp_application_documents"

    dilp_application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("dilp_applications.id", ondelete="CASCADE"), nullable=False)
    file_url = db.Column(db.String(1000), nullable=False)
    original_filename = db.Column(db.String(255), nullable=True)
    ocr_text = db.Column(db.Text, nullable=True)

    application = db.relationship("DilpApplication", back_populates="documents")

    def to_dict(self):
        return {
            "id": str(self.id),
            "file_url": self.file_url,
            "original_filename": self.original_filename,
            "uploaded_at": self.created_at.isoformat() if self.created_at else None,
        }


class DilpApplicationRemark(BaseModel):
    """Staff-only internal note, visible to the jobseeker as read-only. Multiple remarks
    accumulate over the life of an application, each attributed to the staff member who
    wrote it — mirrors OwwaRequestRemark."""

    __tablename__ = "dilp_application_remarks"

    dilp_application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("dilp_applications.id", ondelete="CASCADE"), nullable=False)
    staff_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    remark = db.Column(db.Text, nullable=False)

    application = db.relationship("DilpApplication", back_populates="remarks")
    staff = db.relationship("User")

    def to_dict(self):
        return {
            "id": str(self.id),
            "staff_id": str(self.staff_id),
            "staff_name": self.staff.email if self.staff else None,
            "remark": self.remark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DilpStatusHistory(BaseModel):
    """Full status-change timeline — required (not just per-status timestamp columns)
    because the no_show -> scheduled reschedule loop can happen an unbounded number of
    times, and only a separate table can preserve every pass as its own timestamped
    entry. Mirrors models/application.py's ApplicationStatusHistory pattern."""

    __tablename__ = "dilp_status_history"

    dilp_application_id = db.Column(UUID(as_uuid=True), db.ForeignKey("dilp_applications.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = db.Column(db.String(30), nullable=True)  # null only for the initial submission event
    to_status = db.Column(db.String(30), nullable=False)
    changed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # null = jobseeker self-action
    note = db.Column(db.Text, nullable=True)

    application = db.relationship("DilpApplication", back_populates="status_history")
    changed_by_user = db.relationship("User")

    def to_dict(self):
        actor = self.changed_by_user
        return {
            "id": str(self.id),
            "dilp_application_id": str(self.dilp_application_id),
            "from_status": self.from_status,
            "to_status": self.to_status,
            "changed_by_role": actor.role if actor else "jobseeker",
            "note": self.note,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
