import uuid

from sqlalchemy.dialects.postgresql import UUID

from extensions import db
from models.base import BaseModel
from utils.timezone import iso_manila, now_manila

JOBFAIR_STATUSES = ("draft", "published", "ongoing", "completed", "cancelled", "archived")
BOOTH_STATUSES = ("pending", "confirmed", "cancelled", "rejected", "suspended")


class JobFair(BaseModel):
    __tablename__ = "jobfairs"

    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    banner_url = db.Column(db.String(1000), nullable=True)
    venue = db.Column(db.String(500), nullable=False)
    municipality = db.Column(db.String(150), nullable=True)
    event_date = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=True)
    registration_deadline = db.Column(db.DateTime(timezone=True), nullable=True)
    max_employer_slots = db.Column(db.Integer, default=20)
    max_jobseeker_slots = db.Column(db.Integer, default=200)
    contact_person = db.Column(db.String(255), nullable=True)
    contact_number = db.Column(db.String(30), nullable=True)
    requirements = db.Column(db.Text, nullable=True)
    attachments = db.Column(db.JSON, default=list)  # [{"name": ..., "url": ...}]
    status = db.Column(db.String(20), default="draft", nullable=False)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)

    registrations = db.relationship("JobFairRegistration", back_populates="jobfair", cascade="all, delete-orphan")
    booths = db.relationship("JobFairBooth", back_populates="jobfair", cascade="all, delete-orphan")

    __table_args__ = (db.CheckConstraint(f"status IN {JOBFAIR_STATUSES}", name="ck_jobfair_status"),)

    def _active_booths(self) -> list:
        # "Active" = still an occupying/participating registration — excludes
        # withdrawn (cancelled) and disapproved (rejected) ones, so both the
        # slot-limit check and the displayed "registered employers" count
        # agree on what counts as a real registration.
        return [b for b in self.booths if b.status not in ("cancelled", "rejected")]

    def _jobseeker_slots_full(self) -> bool:
        return bool(self.max_jobseeker_slots) and len(self.registrations) >= self.max_jobseeker_slots

    def _employer_slots_full(self) -> bool:
        return bool(self.max_employer_slots) and len(self._active_booths()) >= self.max_employer_slots

    def _deadline_passed(self) -> bool:
        return bool(self.registration_deadline) and now_manila() > self.registration_deadline

    def to_dict(self):
        deadline_passed = self._deadline_passed()
        jobseeker_slots_full = self._jobseeker_slots_full()
        employer_slots_full = self._employer_slots_full()
        is_live = self.status in ("published", "ongoing")
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "banner_url": self.banner_url,
            "venue": self.venue,
            "municipality": self.municipality,
            "event_date": iso_manila(self.event_date),
            "end_time": iso_manila(self.end_time),
            "registration_deadline": iso_manila(self.registration_deadline),
            "max_employer_slots": self.max_employer_slots,
            "max_jobseeker_slots": self.max_jobseeker_slots,
            "contact_person": self.contact_person,
            "contact_number": self.contact_number,
            "requirements": self.requirements,
            "attachments": self.attachments or [],
            "status": self.status,
            "published_at": iso_manila(self.published_at),
            "registered_jobseekers": len(self.registrations),
            "registered_employers": len(self._active_booths()),
            "attended_count": sum(1 for r in self.registrations if r.attended),
            # Computed live (never persisted) so deadline/slot state can never drift
            # out of sync with the underlying data — see jobfair_capacity_service.py
            # for the server-side enforcement that uses the same logic.
            "registration_deadline_passed": deadline_passed,
            "jobseeker_slots_full": jobseeker_slots_full,
            "employer_slots_full": employer_slots_full,
            "jobseeker_registration_open": is_live and not deadline_passed and not jobseeker_slots_full,
            "employer_registration_open": is_live and not deadline_passed and not employer_slots_full,
        }


class JobFairRegistration(BaseModel):
    __tablename__ = "jobfair_registrations"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    jobseeker_profile_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobseeker_profiles.id"), nullable=False)
    registration_number = db.Column(db.String(20), unique=True, nullable=True)
    qr_token = db.Column(db.String(64), unique=True, default=lambda: uuid.uuid4().hex, nullable=False)
    attended = db.Column(db.Boolean, default=False)
    scanned_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobfair = db.relationship("JobFair", back_populates="registrations")
    jobseeker_profile = db.relationship("JobseekerProfile")

    __table_args__ = (db.UniqueConstraint("jobfair_id", "jobseeker_profile_id", name="uq_jobfair_jobseeker"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "jobfair_id": str(self.jobfair_id),
            "jobfair_name": self.jobfair.name if self.jobfair else None,
            "event_date": iso_manila(self.jobfair.event_date) if self.jobfair else None,
            "jobseeker_profile_id": str(self.jobseeker_profile_id),
            "jobseeker_name": self.jobseeker_profile.full_name if self.jobseeker_profile else None,
            "registration_number": self.registration_number,
            "qr_token": self.qr_token,
            "attended": self.attended,
            "scanned_at": iso_manila(self.scanned_at),
            "created_at": iso_manila(self.created_at),
        }


class JobFairBooth(BaseModel):
    """An employer's registration as a participant for a job fair. Predates the
    in-person-only redesign (hence the "booth" naming and the now-unused
    booth_name/description/materials columns, kept but no longer editable —
    see blueprints/jobfair.py) — this model is the employer registration record,
    carrying the pending/confirmed/rejected/suspended approval state machine."""
    __tablename__ = "jobfair_booths"

    jobfair_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfairs.id"), nullable=False)
    employer_company_id = db.Column(UUID(as_uuid=True), db.ForeignKey("employer_companies.id"), nullable=False)
    status = db.Column(db.String(20), default="pending", nullable=False)
    booth_name = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    materials = db.Column(db.JSON, default=list)  # unused since the in-person-only redesign
    review_remarks = db.Column(db.Text, nullable=True)
    reviewed_by = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    jobfair = db.relationship("JobFair", back_populates="booths")
    employer_company = db.relationship("EmployerCompany")
    reviewed_by_user = db.relationship("User", foreign_keys=[reviewed_by])
    positions = db.relationship("JobFairPosition", back_populates="booth", cascade="all, delete-orphan")

    __table_args__ = (
        db.UniqueConstraint("jobfair_id", "employer_company_id", name="uq_jobfair_employer"),
        db.CheckConstraint(f"status IN {BOOTH_STATUSES}", name="ck_booth_status"),
    )

    def to_dict(self):
        company = self.employer_company
        return {
            "id": str(self.id),
            "jobfair_id": str(self.jobfair_id),
            "employer_company_id": str(self.employer_company_id),
            "company_name": company.company_name if company else None,
            "company_logo_url": company.logo_url if company else None,
            "status": self.status,
            "review_remarks": self.review_remarks,
            "reviewed_at": iso_manila(self.reviewed_at),
            "reviewed_by_name": self.reviewed_by_user.email if self.reviewed_by_user else None,
            "created_at": iso_manila(self.created_at),
            "positions": [p.to_dict() for p in self.positions],
        }


class JobFairPosition(BaseModel):
    """A job-fair-only position a confirmed employer plans to offer at that
    specific Job Fair — entirely separate from the regular Vacancy model and
    online-application pipeline. No staff approval, no general job search
    visibility, no Application rows. Purely informational: identifies what
    will be offered in person at the event, scoped to the employer's Job Fair
    registration (JobFairBooth) for that fair's own management/reporting and
    jobseeker/public awareness — deliberately never linked into the regular
    Vacancy Management module."""
    __tablename__ = "jobfair_positions"

    booth_id = db.Column(UUID(as_uuid=True), db.ForeignKey("jobfair_booths.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    job_type = db.Column(db.String(30), nullable=True)
    num_slots = db.Column(db.Integer, nullable=True)

    booth = db.relationship("JobFairBooth", back_populates="positions")

    def to_dict(self):
        return {
            "id": str(self.id),
            "booth_id": str(self.booth_id),
            "title": self.title,
            "description": self.description,
            "job_type": self.job_type,
            "num_slots": self.num_slots,
            "created_at": iso_manila(self.created_at),
        }


class JobFairRegistrationCounter(db.Model):
    """Atomic per-year sequence backing JobFairRegistration.registration_number
    (format JF-<year>-NNNNN). Locked via with_for_update() in
    services/jobfair_capacity_service.py so concurrent registrations across
    fairs in the same year can't collide — replaces the previous approach of
    string-parsing the latest matching row, which wasn't safe under
    concurrent writes."""
    __tablename__ = "jobfair_registration_counters"

    year = db.Column(db.Integer, primary_key=True)
    next_seq = db.Column(db.Integer, nullable=False, default=1)
