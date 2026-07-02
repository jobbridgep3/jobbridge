from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.notification import Notification
from utils.responses import ok

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.get("")
@jwt_required()
def list_notifications():
    notifs = Notification.query.filter_by(user_id=get_jwt_identity()).order_by(Notification.created_at.desc()).limit(100).all()
    return ok([n.to_dict() for n in notifs])


@notifications_bp.put("/mark-read")
@jwt_required()
def mark_read():
    from flask import request

    data = request.get_json(force=True) or {}
    notif = Notification.query.filter_by(id=data.get("id"), user_id=get_jwt_identity()).first()
    if notif:
        notif.is_read = True
        db.session.commit()
    return ok(message="Marked as read.")


@notifications_bp.put("/mark-all-read")
@jwt_required()
def mark_all_read():
    Notification.query.filter_by(user_id=get_jwt_identity(), is_read=False).update({"is_read": True})
    db.session.commit()
    return ok(message="All notifications marked as read.")
