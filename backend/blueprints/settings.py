from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.settings import DEFAULT_SETTINGS, SystemSetting
from models.user import User
from services.audit_service import log_audit
from utils.decorators import role_required
from utils.responses import fail, ok

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")
admin_settings_bp = Blueprint("admin_settings", __name__, url_prefix="/api/admin/settings")


@settings_bp.put("/notifications")
@jwt_required()
def update_notification_prefs():
    # Preferences are stored client-side (localStorage) in this build; endpoint acknowledges the request
    # so the frontend Settings pages have a real API contract to call.
    return ok(message="Notification preferences updated.")


@settings_bp.put("/privacy")
@jwt_required()
@role_required("jobseeker")
def update_privacy():
    return ok(message="Privacy settings updated.")


@admin_settings_bp.get("")
@jwt_required()
@role_required("admin")
def get_system_settings():
    stored = {s.key: s.value for s in SystemSetting.query.all()}
    merged = {**DEFAULT_SETTINGS, **stored}
    return ok(merged)


@admin_settings_bp.put("")
@jwt_required()
@role_required("admin")
def update_system_settings():
    data = request.get_json(force=True) or {}
    for key, value in data.items():
        setting = SystemSetting.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
        else:
            db.session.add(SystemSetting(key=key, value=str(value)))
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "system_settings")
    return ok(message="System settings updated.")
