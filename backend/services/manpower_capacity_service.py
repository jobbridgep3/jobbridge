"""Single source of truth for ManpowerTrainingBatch pooling capacity — mirrors
vacancy_capacity_service.py's SELECT ... FOR UPDATE locking pattern, the only
proven concurrency-safe precedent in this codebase.
"""

from extensions import db
from models.manpower_training import ManpowerTrainingBatch

BATCH_FULL_MESSAGE = "This batch is already full. No additional applicants can be added."


def get_pooled_count(batch):
    return len([a for a in batch.applications if a.status != "declined"])


def get_slots_remaining(batch):
    if batch.max_pax is None:
        return None
    return max(batch.max_pax - get_pooled_count(batch), 0)


def is_batch_full(batch):
    remaining = get_slots_remaining(batch)
    return remaining is not None and remaining <= 0


def lock_batch_and_check_capacity(batch_id, additional_count):
    """Locks the batch row (SELECT ... FOR UPDATE) and re-validates status +
    remaining capacity inside that lock. Call this immediately before pooling
    applicants, with no commit in between — the lock is released on the
    caller's next commit/rollback, which is what actually prevents two
    concurrent requests from both claiming the last slot(s). Returns
    (batch, ok, error_message)."""
    batch = ManpowerTrainingBatch.query.filter_by(id=batch_id).populate_existing().with_for_update().first()
    if not batch:
        db.session.rollback()
        return None, False, "Batch not found."
    if batch.status != "forming":
        db.session.rollback()
        return batch, False, "This batch is no longer accepting applicants."

    remaining = get_slots_remaining(batch)
    if remaining is not None:
        if remaining <= 0:
            db.session.rollback()
            return batch, False, BATCH_FULL_MESSAGE
        if additional_count > remaining:
            db.session.rollback()
            return batch, False, f"Only {remaining} slot(s) remaining in this batch."

    return batch, True, None
