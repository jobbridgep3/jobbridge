"""Single source of truth for the Vacancy lifecycle state machine — used by both
the employer-facing endpoints (blueprints/employer.py) and the staff/admin
endpoints (blueprints/staff.py) so the legal-transitions rule can never drift
between the two call sites. The frontend hand-mirrors this exact map in
frontend/src/lib/vacancyStateMachine.js purely to decide which action buttons to
render — the backend re-checks every transition regardless of what the UI showed.

    draft --(employer submits, requires accreditation)--> pending
    pending --(staff/admin)--> approved | rejected
    rejected --(employer resubmits)--> pending
    approved --(employer/staff publishes)--> published
    approved --(staff/admin)--> suspended
    published --(employer/staff)--> closed | filled
    published --(staff/admin)--> suspended
    closed --(employer reopens, requires accreditation)--> published
    suspended --(admin reinstates)--> published
"""

# (from_status, to_status) -> who may trigger it. "employer_or_staff" covers
# employer, staff, and admin; "staff" covers staff and admin; "admin" is admin-only.
TRANSITIONS = {
    ("draft", "pending"): "employer",
    ("rejected", "pending"): "employer",
    ("pending", "approved"): "staff",
    ("pending", "rejected"): "staff",
    ("approved", "published"): "employer_or_staff",
    ("approved", "suspended"): "staff",
    ("published", "closed"): "employer_or_staff",
    ("published", "filled"): "employer_or_staff",
    ("published", "suspended"): "staff",
    ("closed", "published"): "employer",
    ("suspended", "published"): "admin",
}


def can_transition(current_status: str, new_status: str, actor_role: str) -> bool:
    allowed_actor = TRANSITIONS.get((current_status, new_status))
    if not allowed_actor:
        return False
    if allowed_actor == "employer_or_staff":
        return actor_role in ("employer", "staff", "admin")
    if allowed_actor == "staff":
        return actor_role in ("staff", "admin")
    if allowed_actor == "admin":
        return actor_role == "admin"
    return actor_role == allowed_actor


def legal_next_statuses(current_status: str, actor_role: str) -> list[str]:
    return [to for (frm, to), actor in TRANSITIONS.items() if frm == current_status and can_transition(frm, to, actor_role)]
