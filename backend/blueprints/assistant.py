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

Phase 4 addition — POST /upload-document: a sibling multipart route, not a rewrite of
/chat's JSON contract (matching every other upload route in this codebase, which are all
their own dedicated multipart endpoints separate from any JSON route). File bytes are
processed entirely in memory (see services/document_extraction.py) and never persisted —
nothing is written to disk or Supabase Storage, so there is nothing to clean up. The
extracted text becomes part of that turn's `context`, reusing get_reply() unchanged; a
resume-vs-postings comparison additionally runs for role in (None, "jobseeker") only,
using the exact same published/non-deleted Vacancy visibility already used by
assistant_retrieval's jobseeker/public context — structurally incapable of comparing
against anything that role couldn't already browse.

Phase 5 addition — POST /transcribe: transcribes audio to text and returns ONLY that
text — it does not call get_reply(), does not know about roles/context/history. The
client (ChatbotWidget) populates its existing text input with the transcript and the
user sends it through /chat exactly like a typed message, so voice input reuses that
pipeline unchanged rather than duplicating it. This separation is also what keeps a
future text-to-speech feature (reply -> audio) addable later as its own equally-separate
module/endpoint, without touching this one or /chat.

Feature 2 addition — on-demand report generation: report_intent_service.detect() runs
right after the FAQ check, for authenticated users only. A match short-circuits Groq
entirely (deterministic whitelisted SQL -> file, via report_generation_service.py —
never freeform AI-written SQL, matching the same "never let the LLM fabricate the data"
posture the FAQ/retrieval paths already have) and returns a reply containing a markdown
download link, which ReactMarkdown (Phase 6) already renders as a real clickable link.
GET /download/<token> is the actual security boundary — it requires a valid JWT and
checks the requester's identity against the token's recorded owner
(report_download_cache.py) before streaming anything, independent of the token's own
obscurity. A non-match (or a role not permitted for the matched report) falls through
to the normal chat pipeline, same as an FAQ non-match does today.

Feature 6 addition — POST /chat-with-image: a multipart sibling route for camera/visual
Q&A, mirroring /upload-document's shape. The image is validated (services/image_validation.py),
base64-encoded, and passed to get_reply() as an optional image_data_uri — the exact same
role-scoped persona/context/history pipeline as every other message, just with an extra
input modality. Grants no new data access.

Feature 4 addition — conversation persistence: `_respond()` is now the single exit point
for every successful reply (FAQ, report, plain chat, document, image). For an
authenticated caller it upserts an AssistantConversation row via services/conversation_service.py
and returns that row's id as `session_id`; for anonymous callers, `session_id` behaves
exactly as it always has (ephemeral, never persisted — there's no account to scope a row
to). GET/PATCH/DELETE /conversations[/<id>] manage the resulting history — all
`@jwt_required()` (mandatory) and ownership-checked, matching every other user-owned
resource in this app.
"""

import io
import json
import uuid

from flask import Blueprint, current_app, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import limiter
from models.vacancy import Vacancy
from services import (
    conversation_service,
    document_extraction,
    faq_lookup,
    image_validation,
    report_download_cache,
    report_intent_service,
    transcription_service,
)
from services.assistant_retrieval import build_context
from services.assistant_service import get_reply
from services.matching_service import rank_vacancies_for_text
from services.report_generation_service import generate_report_file
from utils.client_ip import get_client_ip
from utils.responses import fail, ok

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

MAX_MESSAGE_LENGTH = 2000

# History trimming — see the Phase 3 plan for the reasoning. The real constraint is
# cost/latency per request, not context-window overflow (Qwen3.6 27B's 131K-token
# window on Groq is far larger than persona + retrieval context + history + message).
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


def _respond(identity: str, session_id: str, user_message: str, reply_text: str, mode: str, attachment_label: str = None):
    """The single exit point for every successful reply. For an authenticated caller,
    persists this turn (creating a new conversation if session_id is absent/foreign/
    invalid) and returns that conversation's real id as session_id. For anonymous
    callers, session_id stays exactly as ephemeral as it's always been — no account to
    persist a row against."""
    if identity:
        conversation_id = conversation_service.upsert_turn(session_id, identity, user_message, reply_text, attachment_label)
        return ok({"reply": reply_text, "session_id": conversation_id, "mode": mode})
    return ok({"reply": reply_text, "session_id": session_id or uuid.uuid4().hex, "mode": mode})


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
    role = get_jwt().get("role") if get_jwt_identity() else None
    identity = get_jwt_identity()

    faq_answer = faq_lookup.match(message)
    if faq_answer:
        return _respond(identity, session_id, message, faq_answer, "faq")

    if identity:
        intent = report_intent_service.detect(message, role)
        if intent:
            report_reply = _try_generate_report(intent, identity, role, session_id, message)
            if report_reply is not None:
                return report_reply

    context = build_context(role, identity)
    history = _clean_history(data.get("history"))

    result = get_reply(message, session_id, role, context, history)
    if result["mode"] == "error":
        return fail(result["detail"], 503, {"session_id": result["session_id"]})
    return _respond(identity, session_id, message, result["reply"], result["mode"])


def _try_generate_report(intent: dict, identity: str, role: str, session_id: str, message: str):
    """Returns a Flask response if report generation succeeded, or None to fall through
    to the normal chat pipeline (role_intent_service already role-checked the match, but
    generate_report_file re-checks independently — defense in depth, never a single check).

    A generation failure (e.g. the PDF renderer's native libs being unavailable) must
    never surface as a raw 500 — same "report failure honestly, never crash the request"
    posture every other AI-touching service in this app already follows.
    """
    try:
        generated = generate_report_file(intent["report_key"], intent["format"], identity, role, intent["date_from"])
    except Exception as exc:  # noqa: BLE001
        current_app.logger.error("Report generation failed for %s/%s: %s", intent["report_key"], intent["format"], exc)
        return fail("Sorry, I couldn't generate that file right now. Please try again in a moment.", 503)
    if not generated:
        return None

    filename, mimetype, file_bytes = generated
    token = report_download_cache.stage(file_bytes, filename, mimetype, identity)
    download_url = f"{request.host_url.rstrip('/')}/api/assistant/download/{token}"
    reply = f"Here's your generated file: [Download {filename}]({download_url})\n\nThis link will expire in 15 minutes."
    return _respond(identity, session_id, message, reply, "report")


def _format_matches(ranked: list) -> str:
    if not ranked:
        return "Job match comparison: no strong matches were found between this document and current postings."
    lines = "\n".join(f"- \"{v.title}\" — {score:.0f}% match" for v, score in ranked)
    return f"Job match comparison (against currently published postings):\n{lines}"


def _parse_history_field(raw: str):
    """Multipart form fields are always strings — the history array arrives JSON-encoded.
    A malformed/missing field becomes [] rather than a 500; _clean_history() validates
    the actual shape of whatever comes out of this."""
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return []


@assistant_bp.post("/upload-document")
@jwt_required(optional=True)
@limiter.limit("10 per minute", key_func=get_client_ip)
def upload_document():
    file = request.files.get("file")
    if not file:
        return fail("No file uploaded.", 400)

    file_bytes = file.read()
    filename = document_extraction.sanitize_filename(file.filename or "upload")
    error = document_extraction.validate(file_bytes, filename)
    if error:
        return fail(error, 400)

    extraction = document_extraction.extract_text(file_bytes, filename)
    if extraction["mode"] == "error":
        return fail(extraction["detail"], 400)

    role = get_jwt().get("role") if get_jwt_identity() else None
    identity = get_jwt_identity()

    doc_context = f'Uploaded document "{filename}":\n\n{extraction["text"]}'
    if role in (None, "jobseeker"):
        # Same published+non-deleted visibility already used by assistant_retrieval's
        # jobseeker/public context — comparison never sees anything that role couldn't
        # already browse via GET /api/jobs.
        vacancies = Vacancy.query.filter_by(status="published").filter(Vacancy.deleted_at.is_(None)).all()
        ranked = [pair for pair in rank_vacancies_for_text(extraction["text"], vacancies)[:5] if pair[1] > 0]
        doc_context += "\n\n" + _format_matches(ranked)

    context = build_context(role, identity) + "\n\n" + doc_context
    message = (request.form.get("message") or "").strip() or "Please summarize this document and tell me what it's about."
    history = _clean_history(_parse_history_field(request.form.get("history")))

    result = get_reply(message, request.form.get("session_id"), role, context, history)
    if result["mode"] == "error":
        return fail(result["detail"], 503, {"session_id": result["session_id"]})
    return _respond(identity, request.form.get("session_id"), message, result["reply"], result["mode"], filename)


@assistant_bp.post("/transcribe")
@jwt_required(optional=True)
@limiter.limit("10 per minute", key_func=get_client_ip)
def transcribe_audio():
    file = request.files.get("file")
    if not file:
        return fail("No audio uploaded.", 400)

    audio_bytes = file.read()
    filename = file.filename or "recording.webm"
    error = transcription_service.validate_audio(audio_bytes, filename)
    if error:
        return fail(error, 400)

    result = transcription_service.transcribe(audio_bytes, filename)
    if result["mode"] == "error":
        return fail(result["detail"], 503)
    return ok({"transcript": result["transcript"]})


@assistant_bp.get("/download/<token>")
@jwt_required()
def download_report(token):
    identity = get_jwt_identity()
    entry = report_download_cache.retrieve(token, identity)
    if not entry:
        return fail("This download link has expired or is invalid.", 404)
    return send_file(
        io.BytesIO(entry["bytes"]),
        mimetype=entry["mimetype"],
        as_attachment=True,
        download_name=entry["filename"],
    )


@assistant_bp.post("/chat-with-image")
@jwt_required(optional=True)
@limiter.limit("10 per minute", key_func=get_client_ip)
def chat_with_image():
    file = request.files.get("image")
    if not file:
        return fail("No image uploaded.", 400)

    image_bytes = file.read()
    filename = file.filename or "photo.jpg"
    error = image_validation.validate(image_bytes, filename)
    if error:
        return fail(error, 400)

    mimetype = image_validation.detect_mimetype(image_bytes)
    image_data_uri = image_validation.to_data_uri(image_bytes, mimetype)

    role = get_jwt().get("role") if get_jwt_identity() else None
    identity = get_jwt_identity()
    context = build_context(role, identity)
    message = (request.form.get("message") or "").strip() or "What do you see in this image?"
    history = _clean_history(_parse_history_field(request.form.get("history")))

    result = get_reply(message, request.form.get("session_id"), role, context, history, image_data_uri)
    if result["mode"] == "error":
        return fail(result["detail"], 503, {"session_id": result["session_id"]})
    return _respond(identity, request.form.get("session_id"), message, result["reply"], result["mode"], "photo")


@assistant_bp.get("/conversations")
@jwt_required()
def list_conversations():
    return ok(conversation_service.list_conversations(get_jwt_identity()))


@assistant_bp.get("/conversations/<conversation_id>")
@jwt_required()
def get_conversation(conversation_id):
    conversation = conversation_service.get_conversation(conversation_id, get_jwt_identity())
    if not conversation:
        return fail("Conversation not found.", 404)
    return ok(conversation.to_dict())


@assistant_bp.delete("/conversations/<conversation_id>")
@jwt_required()
def delete_conversation(conversation_id):
    deleted = conversation_service.delete_conversation(conversation_id, get_jwt_identity())
    if not deleted:
        return fail("Conversation not found.", 404)
    return ok(None, "Conversation deleted.")


@assistant_bp.patch("/conversations/<conversation_id>")
@jwt_required()
def update_conversation(conversation_id):
    data = request.get_json(force=True) or {}
    conversation = conversation_service.update_conversation(
        conversation_id,
        get_jwt_identity(),
        is_pinned=data.get("is_pinned"),
        is_favorite=data.get("is_favorite"),
        title=data.get("title"),
    )
    if not conversation:
        return fail("Conversation not found.", 404)
    return ok(conversation.to_summary_dict())
