from flask import Blueprint

from services.dashboard_service import build_public_summary
from utils.responses import ok

public_home_bp = Blueprint("public_home", __name__, url_prefix="/api/public")


@public_home_bp.get("/homepage-stats")
def homepage_stats():
    return ok(build_public_summary())
