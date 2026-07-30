"""Single source of truth for vacancy slot capacity.

An application occupies a slot from the moment it's created until it's
rejected/withdrawn, or — once it reaches "hired" — until the resulting
employment ends (resign/terminate/contract-end/complete). Application.status
stays "hired" forever (terminal, see application_status_service.py), so a
post-hire release has to be read off EmploymentRecord instead.
"""

from extensions import db
from models.application import Application
from models.employment import EMPLOYMENT_END_STATUSES, EmploymentRecord
from models.vacancy import Vacancy
from sockets.events import emit_broadcast

VACANCY_FULL_MESSAGE = (
    "This vacancy is currently full. Please wait until another applicant "
    "withdraws their application or a slot becomes available."
)

# Terminal application statuses that release a slot (mirrors the terminal
# states in services/application_status_service.ALLOWED_TRANSITIONS, which
# already treats hired/rejected/cancelled as having no further transitions).
APPLICATION_RELEASE_STATUSES = ("rejected", "cancelled")


def get_filled_slots(vacancy_id):
    in_pipeline = Application.query.filter(
        Application.vacancy_id == vacancy_id,
        ~Application.status.in_(APPLICATION_RELEASE_STATUSES + ("hired",)),
    ).count()

    hired_still_employed = (
        db.session.query(Application)
        .join(EmploymentRecord, EmploymentRecord.application_id == Application.id)
        .filter(
            Application.vacancy_id == vacancy_id,
            Application.status == "hired",
            ~EmploymentRecord.status.in_(EMPLOYMENT_END_STATUSES),
        )
        .count()
    )
    return in_pipeline + hired_still_employed


def get_slots_remaining(vacancy):
    return max((vacancy.num_slots or 1) - get_filled_slots(vacancy.id), 0)


def is_vacancy_full(vacancy):
    return get_slots_remaining(vacancy) <= 0


def annotate_capacity(payload, vacancy):
    """Adds slots_remaining/is_full to a serialized vacancy dict in place."""
    payload["slots_remaining"] = get_slots_remaining(vacancy)
    payload["is_full"] = payload["slots_remaining"] <= 0
    return payload


def lock_vacancy_and_check_capacity(vacancy_id):
    """Locks the vacancy row (SELECT ... FOR UPDATE) and re-validates capacity
    inside that lock. Call this immediately before creating/reopening an
    Application, with no commit in between — the lock is released on the
    caller's next commit/rollback, which is what actually prevents two
    concurrent requests from both claiming the last slot. Returns
    (vacancy, ok, error_message)."""
    vacancy = Vacancy.query.filter_by(id=vacancy_id).populate_existing().with_for_update().first()
    if not vacancy or is_vacancy_full(vacancy):
        db.session.rollback()
        return vacancy, False, VACANCY_FULL_MESSAGE
    return vacancy, True, None


def recalculate_vacancy_status(vacancy_id):
    """Call this after ANY event that changes a vacancy's occupied-slot count:
    applying, withdrawing, employer rejecting, hiring, an employment record
    entering/leaving an end-status (resigned/terminated/contract-ended) via
    either the employer or PESO-staff path, or the employer editing Openings.

    There is no stored Open/Full status to write — capacity is always
    derived live (get_slots_remaining/is_vacancy_full above) from num_slots
    and current occupancy, so the next read is already correct. This
    function's only job is the real-time broadcast, so every live-listening
    page (Job Search, Homepage, Job Details, Employer Vacancy Management,
    referral picker) refreshes immediately instead of on next reload.
    """
    emit_broadcast("public:homepage_update", {"sections": ["jobs"]})
