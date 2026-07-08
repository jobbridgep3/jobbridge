from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.announcement import Announcement
from models.employer import EmployerCompany
from models.jobseeker import JobseekerProfile
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_announcement_email
from sockets.events import emit_to_role
from utils.decorators import role_required
from utils.responses import fail, ok

announcements_bp = Blueprint("announcements", __name__, url_prefix="/api/announcements")


@announcements_bp.get("")
@jwt_required()
def list_announcements():
    role = get_jwt().get("role")
    query = Announcement.query.filter(Announcement.published_at.isnot(None))
    if role == "jobseeker":
        query = query.filter(Announcement.target_audience.in_(("all", "jobseekers")))
    elif role == "employer":
        query = query.filter(Announcement.target_audience.in_(("all", "employers")))
    announcements = query.order_by(Announcement.is_pinned.desc(), Announcement.published_at.desc()).limit(50).all()
    return ok([a.to_dict() for a in announcements])


@announcements_bp.post("")
@jwt_required()
@role_required("staff", "admin")
def create_announcement():
    data = request.get_json(force=True) or {}
    announcement = Announcement(
        title=data.get("title", ""), body=data.get("body", ""),
        target_audience=data.get("target_audience", "all"),
        is_pinned=bool(data.get("is_pinned")) and get_jwt().get("role") == "admin",
        created_by=get_jwt_identity(),
    )
    publish_now = data.get("publish_now", True)
    if publish_now:
        announcement.published_at = datetime.utcnow()

    db.session.add(announcement)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "announcements", announcement.id)

    if publish_now:
        _broadcast(announcement)

    return ok(announcement.to_dict(), "Announcement created.", 201)


def _broadcast(announcement: Announcement):
    targets = ["jobseeker", "employer"] if announcement.target_audience == "all" else (
        ["jobseeker"] if announcement.target_audience == "jobseekers" else ["employer"]
    )
    reach = 0
    for role in targets:
        emit_to_role(role, "announcement:new", announcement.to_dict())

    recipients = []
    if "jobseeker" in targets:
        recipients += [p for p in JobseekerProfile.query.all()]
    if "employer" in targets:
        recipients += [c for c in EmployerCompany.query.all()]
    for r in recipients:
        user = User.query.get(r.user_id)
        if user:
            send_announcement_email(user.email, announcement.title, announcement.body)
            reach += 1
    announcement.reach_count = reach
    db.session.commit()


@announcements_bp.put("/<announcement_id>")
@jwt_required()
@role_required("staff", "admin")
def update_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("title", "body", "target_audience"):
        if field in data:
            setattr(announcement, field, data[field])
    was_unpublished = announcement.published_at is None
    if data.get("publish_now") and was_unpublished:
        announcement.published_at = datetime.utcnow()
        db.session.commit()
        _broadcast(announcement)
    else:
        db.session.commit()
    return ok(announcement.to_dict(), "Announcement updated.")


@announcements_bp.delete("/<announcement_id>")
@jwt_required()
@role_required("staff", "admin")
def delete_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    db.session.delete(announcement)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "announcements", announcement_id)
    return ok(message="Announcement deleted.")
