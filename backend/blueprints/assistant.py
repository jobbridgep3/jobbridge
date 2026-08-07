"""AI assistant chat endpoint (Groq). Replaces the former /api/chatbot Dialogflow route.

Auth posture is carried over unchanged from the old chatbot blueprint:
@jwt_required(optional=True), so the widget works for signed-in users and the route stays
usable anonymously. Because it is reachable without a token AND every call costs money
upstream, it carries an explicit rate limit and a message-length cap.

Role is derived from the signed JWT claim, the same trust boundary every other protected
route in this app uses (see utils/decorators.py role_required) — never from the request
body. The `get_jwt().get("role") if get_jwt_identity() else None` idiom mirrors the one
optional-auth precedent in this codebase (blueprints/jobfair.py's list_jobfairs): under
jwt_required(optional=True), get_jwt_identity() returns None (not a raise) when no token
was sent, so identity is checked first before ever reading claims.
"""

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import limiter
from services.assistant_service import get_reply
from utils.client_ip import get_client_ip
from utils.responses import fail, ok

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

MAX_MESSAGE_LENGTH = 2000


@assistant_bp.post("/chat")
@jwt_required(optional=True)
@limiter.limit("20 per minute", key_func=get_client_ip)
def chat():
    data = request.get_json(force=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return fail("Message is required.", 400)
    if len(message) > MAX_MESSAGE_LENGTH:
        return fail(f"Message is too long ({MAX_MESSAGE_LENGTH} character max).", 400)

    role = get_jwt().get("role") if get_jwt_identity() else None
    result = get_reply(message, data.get("session_id"), role)
    if result["mode"] == "error":
        return fail(result["detail"], 503, {"session_id": result["session_id"]})
    return ok(result)
