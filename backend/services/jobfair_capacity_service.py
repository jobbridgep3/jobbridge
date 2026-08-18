"""Race-condition-safe job fair registration checks.

Locks the JobFair row (SELECT ... FOR UPDATE) and re-validates status/deadline/
slot-capacity inside that lock — the same proven pattern used by
spes_service.lock_batch_and_check_capacity and
manpower_capacity_service.lock_batch_and_check_capacity. Call one of the
lock_* functions immediately before creating the registration/booth row, with
no commit in between, so two simultaneous requests can't both pass the
capacity check and jointly exceed the slot limit.
"""

from extensions import db
from models.jobfair import JobFair, JobFairBooth, JobFairRegistration, JobFairRegistrationCounter
from utils.timezone import now_manila


def lock_jobfair_for_jobseeker_registration(jobfair_id):
    """Returns (fair, ok, error_message)."""
    fair = JobFair.query.filter_by(id=jobfair_id).populate_existing().with_for_update().first()
    if not fair:
        db.session.rollback()
        return None, False, "Job fair not found."
    if fair.status not in ("published", "ongoing"):
        db.session.rollback()
        return fair, False, "This job fair is not open for registration."
    if fair.registration_deadline and now_manila() > fair.registration_deadline:
        db.session.rollback()
        return fair, False, "The registration deadline for this job fair has passed."
    if fair.max_jobseeker_slots:
        count = JobFairRegistration.query.filter_by(jobfair_id=fair.id).count()
        if count >= fair.max_jobseeker_slots:
            db.session.rollback()
            return fair, False, "This job fair has reached its maximum number of participants."
    return fair, True, None


def lock_jobfair_for_employer_registration(jobfair_id):
    """Returns (fair, ok, error_message)."""
    fair = JobFair.query.filter_by(id=jobfair_id).populate_existing().with_for_update().first()
    if not fair:
        db.session.rollback()
        return None, False, "Job fair not found."
    if fair.status not in ("published", "ongoing"):
        db.session.rollback()
        return fair, False, "This job fair is not open for registration."
    if fair.max_employer_slots:
        count = JobFairBooth.query.filter(
            JobFairBooth.jobfair_id == fair.id,
            JobFairBooth.status.notin_(("cancelled", "rejected")),
        ).count()
        if count >= fair.max_employer_slots:
            db.session.rollback()
            return fair, False, "This job fair has no employer slots remaining."
    return fair, True, None


def next_registration_number() -> str:
    """Atomically allocates the next JF-<year>-NNNNN registration number by
    locking (and lazily creating) the current year's counter row."""
    year = now_manila().year
    counter = JobFairRegistrationCounter.query.filter_by(year=year).populate_existing().with_for_update().first()
    if not counter:
        counter = JobFairRegistrationCounter(year=year, next_seq=1)
        db.session.add(counter)
        db.session.flush()
    seq = counter.next_seq
    counter.next_seq = seq + 1
    return f"JF-{year}-{seq:05d}"
