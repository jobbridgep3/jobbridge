"""Single source of truth for application status transitions.

Every endpoint that changes an application's status must go through
transition_application() so the timeline (ApplicationStatusHistory), audit trail,
website notification, and email notification always stay in sync.
"""

from extensions import db
from models.application import APPLICATION_STATUS_LABELS, Application, ApplicationStatusHistory
from models.employment import EMPLOYMENT_END_STATUSES, EmploymentRecord
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_application_status_email
from services.notification_service import notify_user

# Employer-driven pipeline. Terminal statuses have no exits. "cancelled" is only
# reachable by the jobseeker (withdraw) and only before review begins.
ALLOWED_TRANSITIONS = {
    "applied": {"under_review", "shortlisted", "interview_scheduled", "hired", "rejected", "cancelled"},
    "under_review": {"shortlisted", "interview_scheduled", "background_verification", "offer_extended", "hired", "rejected", "cancelled"},
    "shortlisted": {"under_review", "interview_scheduled", "background_verification", "offer_extended", "hired", "rejected"},
    "interview_scheduled": {"shortlisted", "interview_completed", "background_verification", "offer_extended", "hired", "rejected"},
    "interview_completed": {"shortlisted", "interview_scheduled", "background_verification", "offer_extended", "hired", "rejected"},
    "background_verification": {"offer_extended", "hired", "rejected"},
    "offer_extended": {"hired", "rejected"},
    "hired": set(),
    "rejected": set(),
    "cancelled": set(),
}


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in ALLOWED_TRANSITIONS.get(from_status, set())


def is_currently_employed_at_company(jobseeker_profile_id, employer_company_id, exclude_application_id=None):
    """True if this jobseeker has an active (non-ended) EmploymentRecord at this
    employer — i.e. currently hired, not yet resigned/terminated/contract-ended."""
    query = EmploymentRecord.query.filter(
        EmploymentRecord.jobseeker_profile_id == jobseeker_profile_id,
        EmploymentRecord.employer_company_id == employer_company_id,
        ~EmploymentRecord.status.in_(EMPLOYMENT_END_STATUSES),
    )
    if exclude_application_id:
        query = query.filter(
            db.or_(EmploymentRecord.application_id.is_(None), EmploymentRecord.application_id != exclude_application_id)
        )
    return query.first() is not None


def transition_application(application, new_status, actor_user, note=None, notify=True):
    """Moves an application to new_status, recording history + audit + notifications.

    Returns (ok, error_message). Commits the session — pending objects added by the
    caller (e.g. a new Interview row) are committed together with the transition.
    """
    old_status = application.status
    if new_status == old_status:
        return True, None
    if not can_transition(old_status, new_status):
        return False, (
            f"Cannot move this application from "
            f"'{APPLICATION_STATUS_LABELS.get(old_status, old_status)}' to "
            f"'{APPLICATION_STATUS_LABELS.get(new_status, new_status)}'."
        )
    if new_status == "hired" and is_currently_employed_at_company(
        application.jobseeker_profile_id, application.vacancy.employer_company_id, exclude_application_id=application.id,
    ):
        return False, "This jobseeker is currently employed in another position at this company."

    application.status = new_status
    db.session.add(ApplicationStatusHistory(
        application_id=application.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=actor_user.id if actor_user else None,
        note=note,
    ))
    db.session.commit()

    log_audit(
        actor_user, "Update", "applications", application.id,
        f"Status: {old_status} -> {new_status}" + (f" — {note}" if note else ""),
        before={"status": old_status}, after={"status": new_status},
    )

    if notify:
        _notify_parties(application, old_status, new_status, note)
    return True, None


def _notify_parties(application, old_status, new_status, note):
    vacancy = application.vacancy
    company = vacancy.employer_company if vacancy else None
    label = APPLICATION_STATUS_LABELS.get(new_status, new_status)
    payload = {"application_id": str(application.id), "new_status": new_status, "status_label": label}

    if new_status == "cancelled":
        # Jobseeker withdrew — tell the employer instead of the jobseeker.
        if company:
            notify_user(
                company.user_id, "application_status", "Application withdrawn",
                f"{application.jobseeker_profile.full_name} withdrew their application for {vacancy.title}.",
                link=f"/employer/applicants/{application.id}",
                socket_event="application:status_update", socket_payload=payload,
            )
        return

    jobseeker = application.jobseeker_profile
    notify_user(
        jobseeker.user_id, "application_status", f"Application update: {label}",
        f"Your application for {vacancy.title} at {company.company_name if company else ''} is now \"{label}\".",
        link="/jobseeker/applications",
        socket_event="application:status_update", socket_payload=payload,
    )
    jobseeker_user = User.query.get(jobseeker.user_id)
    if jobseeker_user:
        send_application_status_email(
            jobseeker_user.email, jobseeker.full_name, vacancy.title,
            company.company_name if company else "the employer", label, note,
        )


def build_timeline(application):
    """Status history for display, synthesizing the initial 'Application Submitted'
    event for applications created before the history table existed."""
    events = [h.to_dict() for h in application.status_history]
    if not any(e["to_status"] == "applied" and e["from_status"] is None for e in events):
        events.insert(0, {
            "id": None,
            "application_id": str(application.id),
            "from_status": None,
            "to_status": "applied",
            "to_status_label": APPLICATION_STATUS_LABELS["applied"],
            "changed_by_role": "jobseeker",
            "note": None,
            "created_at": application.created_at.isoformat() if application.created_at else None,
        })
    return events


def record_initial_history(application, actor_user):
    """Writes the 'Application Submitted' event when an application is created."""
    db.session.add(ApplicationStatusHistory(
        application_id=application.id,
        from_status=None,
        to_status="applied",
        changed_by=actor_user.id if actor_user else None,
    ))
    db.session.commit()
