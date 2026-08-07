"""AI assistant backed by Groq (Llama 3.3 70B), replacing the former Dialogflow ES bot.

Groq exposes an OpenAI-compatible chat/completions endpoint, so this is a plain HTTPS
POST via `requests` — no vendor SDK, no service-account key file, no extra dependency.
The API key comes from GROQ_API_KEY (env only; never committed, never sent to the
browser).

Phase 1 scope — deliberately minimal:
  - single-turn, stateless. `session_id` is generated/echoed so the request contract is
    already correct for the chat-history phase, but nothing is stored server-side and no
    prior turns are sent to the model.
  - no role awareness, no database retrieval/RAG, no document or voice input.
  - one short static system prompt; no user or role data is interpolated into it.

There is NO canned-response fallback (the Dialogflow build had one, which meant a broken
integration was indistinguishable from a working one — the deployed bot silently served
hardcoded keyword replies for its entire life because DIALOGFLOW_CREDENTIALS_PATH was
never set on Render). Any failure here is reported honestly as mode "error" with a
user-safe detail string, and callers must check `mode` rather than assume success.

eventlet: the app runs on a single eventlet worker (see render.yaml startCommand), and
`requests`/urllib3 socket I/O is not covered by eventlet's monkey_patch() in a way that's
safe to call directly from a greenlet — doing so would freeze every other request and
Socket.IO until the LLM responds. The HTTP call is therefore offloaded via
eventlet.tpool.execute(), exactly as services/ocr_service.py does. tpool dispatches to
real OS threads that do NOT inherit the Flask app context, so all current_app.config
reads must happen before entering tpool, never inside the offloaded function.
"""

import logging
import uuid

import requests

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Connect / read timeouts. The read timeout must stay well inside gunicorn's 90s worker
# timeout so a slow upstream surfaces as our own clean 503 rather than a killed worker.
_TIMEOUT = (10, 30)

_SYSTEM_PROMPT = (
    "You are the JobBridge assistant for PESO Pila, a Public Employment Service Office "
    "in the Philippines. Help users with job searching, applications, resumes, and PESO "
    "programs such as SPES, DILP, OWWA, and job fairs. Be concise, friendly, and "
    "practical. If you are unsure about a specific PESO Pila policy or a user's own "
    "records, say so and suggest contacting PESO Pila staff rather than guessing."
)

_ERR_UNCONFIGURED = "The AI assistant is not configured on this server."
_ERR_TIMEOUT = "The assistant took too long to respond. Please try again."
_ERR_UNAVAILABLE = "The assistant is temporarily unavailable. Please try again in a moment."


def is_assistant_configured() -> bool:
    from flask import current_app

    return bool(current_app.config.get("GROQ_API_KEY"))


def _call_groq(api_key: str, model: str, message: str) -> str:
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access.

    Returns the reply text, or raises. Upstream error bodies are logged but never
    returned to the caller verbatim: they can echo request details, and a 401 body in
    particular should not reach the browser.
    """
    resp = requests.post(
        GROQ_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            "temperature": 0.6,
            "max_tokens": 1024,
        },
        timeout=_TIMEOUT,
    )

    if resp.status_code >= 300:
        # resp.text, not an exception chain — Groq returns a JSON error body explaining
        # bad key / unknown model / rate limit, which is what you need in the logs.
        raise RuntimeError(f"Groq returned {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    reply = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    reply = (reply or "").strip()
    if not reply:
        raise RuntimeError(f"Groq returned no message content: {str(data)[:500]}")
    return reply


def get_reply(message: str, session_id: str = None) -> dict:
    """Returns {"reply": str|None, "session_id": str, "mode": "groq"|"error", "detail": str|None}."""
    session_id = session_id or uuid.uuid4().hex

    if not is_assistant_configured():
        logger.warning("GROQ_API_KEY is not configured — cannot answer assistant message.")
        return {"reply": None, "session_id": session_id, "mode": "error", "detail": _ERR_UNCONFIGURED}

    # Read config BEFORE entering tpool — the offloaded thread has no app context.
    from flask import current_app

    api_key = current_app.config["GROQ_API_KEY"]
    model = current_app.config["GROQ_MODEL"]

    import eventlet.tpool

    try:
        reply = eventlet.tpool.execute(_call_groq, api_key, model, message)
        return {"reply": reply, "session_id": session_id, "mode": "groq", "detail": None}
    except requests.Timeout as exc:
        logger.error("Groq request timed out: %s", exc)
        return {"reply": None, "session_id": session_id, "mode": "error", "detail": _ERR_TIMEOUT}
    except Exception as exc:  # noqa: BLE001
        logger.error("Groq request failed: %s", exc)
        return {"reply": None, "session_id": session_id, "mode": "error", "detail": _ERR_UNAVAILABLE}
