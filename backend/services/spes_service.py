"""Registration-time business logic for the SPES module: eligibility validation,
capacity locking, and application reference number generation. Kept out of
blueprints/spes.py so the route handlers stay thin, matching this codebase's
existing service-layer convention (see manpower_capacity_service.py).
"""

from extensions import db
from models.spes import SpesApplication, SpesBatch
from utils.timezone import now_manila

BATCH_FULL_MESSAGE = "This batch has reached its total slots. No additional applicants can register."


def get_current_applicants(batch: SpesBatch) -> int:
    # A rejected application frees up the slot it occupied — every other status still
    # counts against capacity for the life of the batch.
    return len([a for a in batch.applications if a.status != "rejected"])


def get_slots_remaining(batch: SpesBatch) -> int:
    return max(batch.total_slots - get_current_applicants(batch), 0)


def is_batch_full(batch: SpesBatch) -> bool:
    return get_slots_remaining(batch) <= 0


def generate_application_ref_no() -> str:
    """SPES-{year}-{zero-padded sequence}, sequence scoped per calendar year across
    all batches — mirrors jobfair.py's _next_registration_number pattern."""
    year = now_manila().year
    prefix = f"SPES-{year}-"
    latest = (
        SpesApplication.query.filter(SpesApplication.application_ref_no.like(f"{prefix}%"))
        .order_by(SpesApplication.application_ref_no.desc()).first()
    )
    seq = int(latest.application_ref_no.rsplit("-", 1)[1]) + 1 if latest else 1
    return f"{prefix}{seq:06d}"


def validate_registration_eligibility(profile, batch: SpesBatch, age: int, gwa, family_income):
    """Server-side re-validation of everything the registration form's inline
    validation already checked client-side — never trust the frontend alone.
    Returns (ok: bool, error_message: str | None)."""
    if batch.status != "open":
        return False, "This batch is not currently open for registration."
    today = now_manila().date()
    if today < batch.open_date:
        return False, "Registration for this batch has not opened yet."
    if today > batch.registration_deadline:
        return False, "The registration deadline for this batch has passed."
    if age < 15 or age > 30:
        return False, "You must be between 15 and 30 years old to register for SPES."
    # GWA is on this program's percentage/point scale where a higher value is better
    # (e.g. 80, 85) — min_gwa is the minimum passing threshold an applicant must meet
    # or exceed, consistent with the "min_" field name.
    if batch.min_gwa is not None and gwa < batch.min_gwa:
        return False, f"Your GWA does not meet this batch's minimum passing threshold of {batch.min_gwa}."
    if batch.max_family_income is not None and family_income > batch.max_family_income:
        return False, "Your declared family income exceeds this batch's eligibility threshold for this program."
    if SpesApplication.query.filter_by(batch_id=batch.id, jobseeker_profile_id=profile.id).first():
        return False, "You have already registered for this batch."
    return True, None


def lock_batch_and_check_capacity(batch_id):
    """Locks the batch row (SELECT ... FOR UPDATE) and re-validates status + remaining
    capacity inside that lock — the proven concurrency-safe pattern from
    manpower_capacity_service.py, adapted for SPES's single-registration-at-a-time
    capacity model (no additional_count parameter needed since SPES registers one
    applicant per request, unlike ManPower's batch-pooling). Call this immediately
    before creating the application row, with no commit in between. Returns
    (batch, ok, error_message)."""
    batch = SpesBatch.query.filter_by(id=batch_id).populate_existing().with_for_update().first()
    if not batch:
        db.session.rollback()
        return None, False, "Batch not found."
    if is_batch_full(batch):
        db.session.rollback()
        return batch, False, BATCH_FULL_MESSAGE
    return batch, True, None
