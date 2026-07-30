"""Single source of truth for vacancy slot capacity.

A slot is "filled" by an active (non-ended) EmploymentRecord tied to an
application for that vacancy — not by Application.status == "hired", which is
terminal and never reverts even after the resulting employment ends (see the
"stale hire" handling in application_status_service.py). Counting off
EmploymentRecord means a slot automatically reopens the instant an employee
resigns/is terminated/completes their contract, with no separate bookkeeping.
"""

from extensions import db
from models.application import Application
from models.employment import EMPLOYMENT_END_STATUSES, EmploymentRecord

VACANCY_FULL_MESSAGE = (
    "This vacancy is currently full. Please wait until another applicant "
    "withdraws their application or a slot becomes available."
)


def get_filled_slots(vacancy_id):
    return (
        db.session.query(EmploymentRecord)
        .join(Application, EmploymentRecord.application_id == Application.id)
        .filter(Application.vacancy_id == vacancy_id, ~EmploymentRecord.status.in_(EMPLOYMENT_END_STATUSES))
        .count()
    )


def get_slots_remaining(vacancy):
    return max((vacancy.num_slots or 1) - get_filled_slots(vacancy.id), 0)


def is_vacancy_full(vacancy):
    return get_slots_remaining(vacancy) <= 0


def annotate_capacity(payload, vacancy):
    """Adds slots_remaining/is_full to a serialized vacancy dict in place."""
    payload["slots_remaining"] = get_slots_remaining(vacancy)
    payload["is_full"] = payload["slots_remaining"] <= 0
    return payload
