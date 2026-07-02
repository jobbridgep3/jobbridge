from extensions import db
from models.notification import Notification
from sockets.events import emit_to_role, emit_to_user


def notify_user(user_id, type_: str, title: str, message: str = None, link: str = None, socket_event: str = None, socket_payload: dict = None):
    """Persists a Notification row and emits a real-time Socket.io event to that user."""
    notif = Notification(user_id=user_id, type=type_, title=title, message=message, link=link)
    db.session.add(notif)
    db.session.commit()

    emit_to_user(user_id, "notification:new", notif.to_dict())
    if socket_event:
        emit_to_user(user_id, socket_event, socket_payload or {})
    return notif


def notify_role(role: str, socket_event: str, socket_payload: dict):
    emit_to_role(role, socket_event, socket_payload)
