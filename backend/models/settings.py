from extensions import db
from models.base import BaseModel

DEFAULT_SETTINGS = {
    "session_timeout_admin_minutes": "15",
    "session_timeout_staff_minutes": "30",
    "session_timeout_default_minutes": "60",
    "rate_limit_login_per_15min": "5",
    "maintenance_mode": "false",
    "lmi_report_schedule_day": "1",
    "lmi_report_schedule_hour": "0",
}


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.String(500), nullable=False)

    def to_dict(self):
        return {"key": self.key, "value": self.value}
