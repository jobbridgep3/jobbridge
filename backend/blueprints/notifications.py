from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.notification import Notification
from sockets.events import emit_to_user
from utils.responses import fail, ok

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


def _base_query(archived=False):
    return Notification.query.filter_by(user_id=get_jwt_identity(), is_archived=archived)


@notifications_bp.get("")
@jwt_required()
def list_notifications():
    archived = request.args.get("archived", "false").lower() == "true"
    query = _base_query(archived=archived)

    filter_ = request.args.get("filter")
    if filter_ == "unread":
        query = query.filter_by(is_read=False)
    elif filter_ == "read":
        query = query.filter_by(is_read=True)

    search = request.args.get("search", "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(db.or_(Notification.title.ilike(like), Notification.message.ilike(like)))

    limit = min(int(request.args.get("limit", 100)), 200)
    offset = int(request.args.get("offset", 0))
    notifs = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return ok([n.to_dict() for n in notifs])


@notifications_bp.get("/unread-count")
@jwt_required()
def unread_count():
    count = Notification.query.filter_by(user_id=get_jwt_identity(), is_read=False, is_archived=False).count()
    return ok({"count": count})


@notifications_bp.put("/mark-read")
@jwt_required()
def mark_read():
    data = request.get_json(force=True) or {}
    notif = Notification.query.filter_by(id=data.get("id"), user_id=get_jwt_identity()).first()
    if not notif:
        return fail("Notification not found.", 404)
    notif.is_read = True
    db.session.commit()
    return ok(notif.to_dict(), "Marked as read.")


@notifications_bp.put("/mark-all-read")
@jwt_required()
def mark_all_read():
    Notification.query.filter_by(user_id=get_jwt_identity(), is_read=False).update({"is_read": True})
    db.session.commit()
    return ok(message="All notifications marked as read.")


@notifications_bp.put("/bulk")
@jwt_required()
def bulk_update():
    data = request.get_json(force=True) or {}
    ids = data.get("ids") or []
    action = data.get("action")
    updates = {
        "read": {"is_read": True},
        "unread": {"is_read": False},
        "archive": {"is_archived": True},
        "unarchive": {"is_archived": False},
    }.get(action)
    if not ids or not updates:
        return fail("ids and a valid action ('read'|'unread'|'archive'|'unarchive') are required.", 400)

    Notification.query.filter(Notification.id.in_(ids), Notification.user_id == get_jwt_identity()).update(
        updates, synchronize_session=False
    )
    db.session.commit()
    user_id = get_jwt_identity()
    emit_to_user(user_id, "notification:bulk_updated", {"ids": ids, "action": action})
    return ok(message="Notifications updated.")


@notifications_bp.put("/<notification_id>/archive")
@jwt_required()
def archive_notification(notification_id):
    notif = Notification.query.filter_by(id=notification_id, user_id=get_jwt_identity()).first()
    if not notif:
        return fail("Notification not found.", 404)
    notif.is_archived = True
    db.session.commit()
    emit_to_user(notif.user_id, "notification:archived", {"id": notification_id})
    return ok(notif.to_dict(), "Notification archived.")


@notifications_bp.put("/<notification_id>/unarchive")
@jwt_required()
def unarchive_notification(notification_id):
    notif = Notification.query.filter_by(id=notification_id, user_id=get_jwt_identity()).first()
    if not notif:
        return fail("Notification not found.", 404)
    notif.is_archived = False
    db.session.commit()
    emit_to_user(notif.user_id, "notification:unarchived", {"id": notification_id})
    return ok(notif.to_dict(), "Notification unarchived.")


@notifications_bp.delete("/bulk")
@jwt_required()
def bulk_delete():
    data = request.get_json(force=True) or {}
    ids = data.get("ids") or []
    if not ids:
        return fail("ids is required.", 400)
    user_id = get_jwt_identity()
    Notification.query.filter(Notification.id.in_(ids), Notification.user_id == user_id).delete(synchronize_session=False)
    db.session.commit()
    emit_to_user(user_id, "notification:bulk_deleted", {"ids": ids})
    return ok(message="Notifications deleted.")


@notifications_bp.delete("/<notification_id>")
@jwt_required()
def delete_notification(notification_id):
    notif = Notification.query.filter_by(id=notification_id, user_id=get_jwt_identity()).first()
    if not notif:
        return fail("Notification not found.", 404)
    user_id = notif.user_id
    db.session.delete(notif)
    db.session.commit()
    emit_to_user(user_id, "notification:deleted", {"id": notification_id})
    return ok(message="Notification deleted.")
