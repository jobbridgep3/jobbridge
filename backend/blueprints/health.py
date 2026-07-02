from flask import Blueprint

from utils.responses import ok

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health():
    return ok({"status": "up"}, "JobBridge API is running.")
