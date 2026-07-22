from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.announcement import Announcement
from models.user import User
from services.announcement_notification_service import publish_and_notify
from services.audit_service import log_audit
from services.storage_service import upload_file, validate_upload_file
from sockets.events import emit_broadcast
from utils.decorators import role_required
from utils.html_sanitizer import sanitize_html
from utils.responses import fail, ok
from utils.timezone import now_manila

announcements_bp = Blueprint("announcements", __name__, url_prefix="/api/announcements")

WRITABLE_FIELDS = ("title", "category", "priority", "is_pinned")
MAX_PINNED = 5


def _visible_query(role):
    now = now_manila()
    return (
        Announcement.query.filter(Announcement.target_roles.contains([role]))
        .filter(Announcement.status == "published")
        .filter(Announcement.published_at.isnot(None), Announcement.published_at <= now)
        .filter(db.or_(Announcement.expires_at.is_(None), Announcement.expires_at > now))
    )


@announcements_bp.get("")
@jwt_required()
def list_announcements():
    role = get_jwt().get("role")
    if role in ("staff", "admin"):
        # Management view: every status, not just what's currently publicly
        # visible, so drafts/archived announcements can be found and edited.
        query = Announcement.query
        if request.args.get("status"):
            query = query.filter_by(status=request.args["status"])
        announcements = query.order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc()).limit(100).all()
    else:
        announcements = _visible_query(role).order_by(Announcement.is_pinned.desc(), Announcement.published_at.desc()).limit(50).all()
    return ok([a.to_dict() for a in announcements])


@announcements_bp.get("/public")
def list_public_announcements():
    announcements = _visible_query("public").order_by(Announcement.is_pinned.desc(), Announcement.published_at.desc()).limit(50).all()
    return ok([a.to_dict() for a in announcements])


@announcements_bp.get("/<announcement_id>")
@jwt_required(optional=True)
def get_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement or announcement.status != "published":
        return fail("Announcement not found.", 404)

    identity = get_jwt_identity()
    role = get_jwt().get("role") if identity else "public"
    if role not in (announcement.target_roles or []):
        return fail("You do not have access to this announcement.", 403)

    result = announcement.to_dict()
    result["related"] = [
        a.to_dict() for a in Announcement.query.filter(
            Announcement.category == announcement.category, Announcement.status == "published",
            Announcement.id != announcement.id,
        ).order_by(Announcement.published_at.desc()).limit(3).all()
    ]
    return ok(result)


def _apply_fields(announcement, data, is_admin):
    for field in WRITABLE_FIELDS:
        if field in data:
            if field == "is_pinned" and not is_admin:
                continue
            setattr(announcement, field, data[field])
    if "body" in data:
        announcement.body = sanitize_html(data["body"])
    if "target_roles" in data:
        roles = data["target_roles"]
        announcement.target_roles = [r for r in roles if r in ("public", "jobseeker", "employer", "staff", "admin")] or ["public"]
    if "scheduled_publish_at" in data:
        announcement.scheduled_publish_at = datetime.fromisoformat(data["scheduled_publish_at"]) if data["scheduled_publish_at"] else None
    if "expires_at" in data:
        announcement.expires_at = datetime.fromisoformat(data["expires_at"]) if data["expires_at"] else None


@announcements_bp.post("")
@jwt_required()
@role_required("staff", "admin")
def create_announcement():
    data = request.get_json(force=True) or {}
    is_admin = get_jwt().get("role") == "admin"
    announcement = Announcement(title=data.get("title", ""), body=sanitize_html(data.get("body", "")), created_by=get_jwt_identity())
    _apply_fields(announcement, data, is_admin)

    db.session.add(announcement)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "announcements", announcement.id)

    if data.get("publish_now"):
        publish_and_notify(announcement, User.query.get(get_jwt_identity()))

    return ok(announcement.to_dict(), "Announcement created.", 201)


@announcements_bp.put("/<announcement_id>")
@jwt_required()
@role_required("staff", "admin")
def update_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    data = request.get_json(force=True) or {}
    is_admin = get_jwt().get("role") == "admin"
    _apply_fields(announcement, data, is_admin)

    should_publish = data.get("publish_now") and announcement.status != "published"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "announcements", announcement.id)

    if should_publish:
        publish_and_notify(announcement, User.query.get(get_jwt_identity()))

    return ok(announcement.to_dict(), "Announcement updated.")


@announcements_bp.post("/<announcement_id>/publish")
@jwt_required()
@role_required("staff", "admin")
def publish_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    if announcement.status == "published":
        return fail("Announcement is already published.", 400)
    publish_and_notify(announcement, User.query.get(get_jwt_identity()))
    return ok(announcement.to_dict(), f"Announcement published — {announcement.reach_count} user(s) notified.")


@announcements_bp.post("/<announcement_id>/archive")
@jwt_required()
@role_required("staff", "admin")
def archive_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    before = {"status": announcement.status}
    announcement.status = "archived"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Archive", "announcements", announcement.id, before=before, after={"status": "archived"})
    emit_broadcast("public:homepage_update", {"sections": ["announcements"]})
    return ok(announcement.to_dict(), "Announcement archived.")


@announcements_bp.put("/<announcement_id>/pin")
@jwt_required()
@role_required("admin")
def pin_announcement(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    data = request.get_json(force=True) or {}
    pin = bool(data.get("is_pinned"))
    if pin and not announcement.is_pinned:
        pinned_count = Announcement.query.filter_by(is_pinned=True, status="published").count()
        if pinned_count >= MAX_PINNED:
            return fail(f"At most {MAX_PINNED} announcements can be pinned at once — unpin one first.", 400)
    announcement.is_pinned = pin
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Pin" if pin else "Unpin", "announcements", announcement.id)
    emit_broadcast("public:homepage_update", {"sections": ["announcements"]})
    return ok(announcement.to_dict(), "Announcement pinned." if pin else "Announcement unpinned.")


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
    emit_broadcast("public:homepage_update", {"sections": ["announcements"]})
    return ok(message="Announcement deleted.")


@announcements_bp.post("/<announcement_id>/banner")
@jwt_required()
@role_required("staff", "admin")
def upload_banner(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach the banner image.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    announcement.banner_url = upload_file(file_bytes, file.filename, f"announcements/{announcement.id}", file.content_type or "image/png")
    db.session.commit()
    return ok(announcement.to_dict(), "Banner uploaded.")


@announcements_bp.post("/<announcement_id>/images")
@jwt_required()
@role_required("staff", "admin")
def upload_image(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach an image.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    url = upload_file(file_bytes, file.filename, f"announcements/{announcement.id}", file.content_type or "image/png")
    announcement.gallery_images = (announcement.gallery_images or []) + [{"name": file.filename, "url": url}]
    db.session.commit()
    return ok(announcement.to_dict(), "Image uploaded.")


@announcements_bp.delete("/<announcement_id>/images")
@jwt_required()
@role_required("staff", "admin")
def delete_image(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    data = request.get_json(force=True) or {}
    url = data.get("url")
    announcement.gallery_images = [img for img in (announcement.gallery_images or []) if img.get("url") != url]
    db.session.commit()
    return ok(announcement.to_dict(), "Image removed.")


@announcements_bp.post("/<announcement_id>/attachment")
@jwt_required()
@role_required("staff", "admin")
def upload_attachment(announcement_id):
    announcement = Announcement.query.get(announcement_id)
    if not announcement:
        return fail("Announcement not found.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach a PDF file.", 400)
    if not file.filename.lower().endswith(".pdf"):
        return fail("Only PDF attachments are allowed.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    announcement.pdf_url = upload_file(file_bytes, file.filename, f"announcements/{announcement.id}", "application/pdf")
    db.session.commit()
    return ok(announcement.to_dict(), "Attachment uploaded.")
