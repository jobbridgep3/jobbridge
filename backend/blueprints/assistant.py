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

Phase 3 additions:
  - faq_lookup.match() runs first — a handful of purely static questions (office hours,
    address, etc.) are answered directly with zero Groq call and zero DB retrieval.
  - assistant_retrieval.build_context() does role/identity-scoped SQL retrieval (request
    greenlet, before get_reply()'s eventlet.tpool call) so the model answers from real
    JobBridge data instead of general guidance.
  - `history`: the client (ChatbotWidget) sends its own held conversation as an optional
    array. _clean_history() validates and trims it server-side before it's ever trusted
    for anything — it only affects that user's own conversation quality, never identity/
    role, which still come solely from the JWT.
"""

import uuid

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import limiter
from services import faq_lookup
from services.assistant_retrieval import build_context
from services.assistant_service import get_reply
from utils.client_ip import get_client_ip
from utils.responses import fail, ok

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

MAX_MESSAGE_LENGTH = 2000

# History trimming — see the Phase 3 plan for the reasoning. The real constraint is
# cost/latency per request, not context-window overflow (Llama 3.3 70B's window is huge).
MAX_HISTORY_TURNS = 6
MAX_HISTORY_TURN_LENGTH = 500
MAX_HISTORY_TOTAL_LENGTH = 3000


def _clean_history(raw) -> list:
    """Validates a client-supplied history array and trims it to a bounded window.

    Drops anything not shaped like {"role": "user"|"assistant", "content": str} rather
    than erroring — a malformed/tampered history can only degrade that one user's own
    conversation, never a security boundary (role/identity for retrieval always comes
    from the JWT, never from history content).
    """
    if not isinstance(raw, list):
        return []

    cleaned = []
    for turn in raw:
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        content = turn.get("content")
        if role not in ("user", "assistant") or not isinstance(content, str) or not content.strip():
            continue
        cleaned.append({"role": role, "content": content.strip()[:MAX_HISTORY_TURN_LENGTH]})

    cleaned = cleaned[-MAX_HISTORY_TURNS:]

    total = 0
    trimmed = []
    for turn in reversed(cleaned):
        total += len(turn["content"])
        if total > MAX_HISTORY_TOTAL_LENGTH:
            break
        trimmed.append(turn)
    trimmed.reverse()
    return trimmed


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

    session_id = data.get("session_id")

    faq_answer = faq_lookup.match(message)
    if faq_answer:
        return ok({"reply": faq_answer, "session_id": session_id or uuid.uuid4().hex, "mode": "faq"})

    role = get_jwt().get("role") if get_jwt_identity() else None
    identity = get_jwt_identity()
    context = build_context(role, identity)
    history = _clean_history(data.get("history"))

    result = get_reply(message, session_id, role, context, history)
    if result["mode"] == "error":
        return fail(result["detail"], 503, {"session_id": result["session_id"]})
    return ok(result)
