from extensions import db
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_announcement_email
from services.notification_service import notify_role, notify_user
from sockets.events import emit_broadcast
from utils.timezone import now_manila

NOTIFIABLE_ROLES = ("jobseeker", "employer", "staff", "admin")


def publish_and_notify(announcement, actor=None):
    """Mirrors the jobfair publish pipeline (blueprints/jobfair.py::publish_jobfair):
    validate/transition + audit, persist one Notification row per recipient, one
    role-level socket broadcast, one email per recipient. Replaces the old
    _broadcast() which only did socket+email and never persisted Notification rows.

    `actor` is None when called from the scheduler (auto-publish has no acting
    user) — log_audit already tolerates a None user, same as every other
    APScheduler-driven state transition in this app skipping audit entirely for
    automated changes; kept here only for the explicit staff/admin-triggered path.
    """
    before = {"status": announcement.status}
    if not announcement.published_at:
        announcement.published_at = now_manila()
    announcement.status = "published"
    db.session.commit()
    if actor:
        log_audit(actor, "Publish", "announcements", announcement.id, before=before, after={"status": "published"})

    excerpt = (announcement.body or "")[:200]
    recipients = []
    for role in NOTIFIABLE_ROLES:
        if role not in (announcement.target_roles or []):
            continue
        for user in User.query.filter_by(role=role, is_active=True).all():
            recipients.append(user)
            notify_user(
                user.id, "announcement_published", announcement.title, excerpt,
                link=f"/announcements/{announcement.id}", priority=announcement.priority,
            )
        notify_role(role, "announcement:published", announcement.to_dict())

    for user in recipients:
        send_announcement_email(user.email, announcement.title, announcement.body)

    announcement.reach_count = len(recipients)
    db.session.commit()
    emit_broadcast("public:homepage_update", {"sections": ["announcements"]})
    return announcement
