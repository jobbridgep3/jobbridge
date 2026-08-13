from extensions import db
from models.notification import Notification
from models.user import User
from sockets.events import emit_to_role, emit_to_user


def notify_user(user_id, type_: str, title: str, message: str = None, link: str = None, socket_event: str = None, socket_payload: dict = None, priority: str = None):
    """Persists a Notification row and emits a real-time Socket.io event to that user.

    `priority` is optional and left unset by nearly every caller — the frontend derives a sensible
    default from `type_` via a static map. Only pass it when the caller has an explicit priority of its
    own to convey (e.g. an announcement's own priority field)."""
    notif = Notification(user_id=user_id, type=type_, title=title, message=message, link=link, priority=priority)
    db.session.add(notif)
    db.session.commit()

    emit_to_user(user_id, "notification:new", notif.to_dict())
    if socket_event:
        emit_to_user(user_id, socket_event, socket_payload or {})
    return notif


def notify_role(role: str, socket_event: str, socket_payload: dict):
    emit_to_role(role, socket_event, socket_payload)


def notify_board(roles_and_links, type_: str, title: str, message: str = None, socket_event: str = None, socket_payload: dict = None):
    """Persisted (bell + unread count) notification for every active user in each given role, with a
    role-specific link — the fan-out pattern proven in owwa.py/manpower_training.py's local
    _notify_board, shared here since several blueprints now need the same "alert staff/admin board"
    behavior. roles_and_links: iterable of (role, link) tuples, e.g.
    [("staff", "/staff/employers/123"), ("admin", "/admin/employers")]."""
    for role, link in roles_and_links:
        for user in User.query.filter_by(role=role, is_active=True).all():
            notify_user(user.id, type_, title, message, link=link, socket_event=socket_event, socket_payload=socket_payload)
