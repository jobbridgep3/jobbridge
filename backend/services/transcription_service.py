"""Speech-to-text for the AI assistant's voice-input feature (Phase 5), via Groq Whisper.

Reuses the existing Groq relationship — same GROQ_API_KEY already configured for chat,
same requests + eventlet.tpool.execute() offload pattern as assistant_service.py, no new
vendor/credentials. The browser only records audio (MediaRecorder); this module sends
those bytes to Groq's OpenAI-compatible /audio/transcriptions endpoint and returns text.

Deliberately narrow scope: this module transcribes and nothing else. It does not call
get_reply(), does not know about roles, context, or chat history — the transcribed text
is handed back to the caller, who feeds it through the EXACT SAME chat pipeline a typed
message already uses (see blueprints/assistant.py's /transcribe route, which is a
sibling to /chat, not a combined endpoint). That separation is deliberate: it's what
lets a future text-to-speech feature (reply -> audio) be added later as an equally
separate module/endpoint, without restructuring this one.

No `language` parameter is forced — Whisper auto-detects, since PESO Pila's real users
code-switch between Tagalog and English, and forcing English would actively hurt
accuracy for exactly the users this office serves.

eventlet: same constraint as assistant_service.py — the app runs a single eventlet
worker, and requests/urllib3 socket I/O is not safe to call directly from a greenlet.
The HTTP call is offloaded via eventlet.tpool.execute(); config must be read in the
request greenlet before entering tpool, never inside the offloaded function.
"""

import logging

import requests

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

# Same read-timeout reasoning as assistant_service.py — comfortably inside gunicorn's 90s
# worker timeout so a slow upstream surfaces as our own clean 503, not a killed worker.
_TIMEOUT = (10, 30)

ALLOWED_EXTENSIONS = {"webm", "ogg", "mp4", "m4a", "wav", "mp3", "mpeg", "mpga", "flac"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB — generous for a <=60s compressed voice clip

_ERR_UNCONFIGURED = "Voice input is not configured on this server."
_ERR_TIMEOUT = "Transcription took too long. Please try again."
_ERR_UNAVAILABLE = "Voice transcription is temporarily unavailable. Please try again, or type your message."


def is_transcription_configured() -> bool:
    from flask import current_app

    return bool(current_app.config.get("GROQ_API_KEY"))


def validate_audio(audio_bytes: bytes, filename: str) -> str | None:
    """Returns an error message if the audio is invalid, else None.

    No magic-byte sniff here (unlike Phase 4's document uploads): MediaRecorder's output
    format legitimately varies by browser (webm/opus in Chrome/Firefox, mp4/aac in
    Safari) and Groq accepts all of them directly — there's no single "wrong-looking"
    signature to check for. Groq's own API is the authoritative content validator; this
    is purely a cost/abuse size guard.
    """
    if not audio_bytes:
        return "No audio was recorded."
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return "Unsupported audio format."
    if len(audio_bytes) > MAX_SIZE_BYTES:
        return "Recording is too long. Please keep it under a minute."
    return None


def _call_groq_whisper(api_key: str, model: str, audio_bytes: bytes, filename: str) -> str:
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access."""
    resp = requests.post(
        GROQ_TRANSCRIPTION_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        files={"file": (filename, audio_bytes)},
        data={"model": model},
        timeout=_TIMEOUT,
    )

    if resp.status_code >= 300:
        raise RuntimeError(f"Groq returned {resp.status_code}: {resp.text[:500]}")

    data = resp.json()
    return (data.get("text") or "").strip()


def transcribe(audio_bytes: bytes, filename: str) -> dict:
    """Returns {"transcript": str|None, "mode": "groq"|"error", "detail": str|None}."""
    if not is_transcription_configured():
        logger.warning("GROQ_API_KEY is not configured — cannot transcribe audio.")
        return {"transcript": None, "mode": "error", "detail": _ERR_UNCONFIGURED}

    from flask import current_app

    api_key = current_app.config["GROQ_API_KEY"]
    model = current_app.config["GROQ_WHISPER_MODEL"]

    import eventlet.tpool

    try:
        transcript = eventlet.tpool.execute(_call_groq_whisper, api_key, model, audio_bytes, filename)
        if not transcript:
            return {"transcript": None, "mode": "error", "detail": "Couldn't make out any speech in that recording. Please try again."}
        return {"transcript": transcript, "mode": "groq", "detail": None}
    except requests.Timeout as exc:
        logger.error("Groq transcription request timed out: %s", exc)
        return {"transcript": None, "mode": "error", "detail": _ERR_TIMEOUT}
    except Exception as exc:  # noqa: BLE001
        logger.error("Groq transcription request failed: %s", exc)
        return {"transcript": None, "mode": "error", "detail": _ERR_UNAVAILABLE}
