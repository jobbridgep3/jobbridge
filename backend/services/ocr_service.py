"""Resume OCR extraction via Google Cloud Vision.

Credentials can come from either:
  - GOOGLE_APPLICATION_CREDENTIALS_JSON — base64-encoded service-account JSON key.
    Used in production (e.g. Render), where a git-ignored key file can't be placed on
    disk since builds start from a fresh git clone.
  - GOOGLE_APPLICATION_CREDENTIALS — a file path to the same JSON key. Used in local
    dev, where the file exists on disk (see backend/credentials/).
Both are explicitly loaded into a google.oauth2 Credentials object and passed to the
Vision client — the client never relies on ambient Application Default Credentials, so
behavior doesn't depend on process-start-time OS environment state.

The client is built ONCE at app boot (init_vision_client, called from create_app) and
cached at module level, for two reasons:
  1. Building it involves a gRPC channel handshake — blocking, non-trivial I/O that
     would otherwise be repeated on every single upload.
  2. Credential/config resolution reads current_app.config, which only exists in the
     greenlet that pushed the Flask app context. eventlet.tpool.execute() dispatches to
     real OS threads that do NOT inherit that context — so config-dependent work must
     happen before entering tpool, never inside the offloaded function.

Google Cloud Vision's document_text_detection() is a synchronous gRPC call. gRPC's
C-extension I/O is not covered by eventlet's monkey_patch() (which only patches
Python-level socket/threading), so calling it directly on the eventlet worker's single
real OS thread would freeze every other concurrent request (and Socket.IO) until it
returns or gunicorn's timeout kills the worker — this previously caused production
WORKER TIMEOUT/SIGKILL crashes. extract_text_from_resume() offloads the blocking work
via eventlet.tpool.execute() to avoid this.

Callers must check the `mode` in the returned dict rather than assuming success: any
failure (unconfigured, auth, billing, quota, network, timeout) is reported as
`mode: "error"` with no text — never fabricated placeholder data merged into a real
user's profile as if it were a genuine extraction.
"""

import base64
import io
import json
import logging
import os

from PIL import Image

logger = logging.getLogger(__name__)

_vision_client = None
_vision_configured = False


def _preprocess_image(file_bytes: bytes) -> bytes:
    """Resize/clean the image for better OCR accuracy (Pillow)."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img = img.convert("RGB")
        max_dim = 2000
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img = img.resize((int(img.width * ratio), int(img.height * ratio)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue()
    except Exception:
        return file_bytes


def _load_credentials(config):
    """Builds an explicit google.oauth2 Credentials object from whichever source is set."""
    from google.oauth2 import service_account

    json_b64 = config.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if json_b64:
        info = json.loads(base64.b64decode(json_b64))
        return service_account.Credentials.from_service_account_info(info)

    path = config.get("GOOGLE_APPLICATION_CREDENTIALS")
    if path and os.path.exists(path):
        return service_account.Credentials.from_service_account_file(path)

    return None


def init_vision_client(app) -> None:
    """Eagerly builds and caches the Vision client at app boot (inside an app context).

    Must run with app context available (reads app.config directly here rather than via
    current_app, so it can also be called from outside a request/app-context push).
    """
    global _vision_client, _vision_configured

    credentials = _load_credentials(app.config)
    if credentials is None:
        _vision_configured = False
        logger.warning("Google Vision not configured — OCR will return errors until credentials are set.")
        return

    from google.cloud import vision

    _vision_client = vision.ImageAnnotatorClient(credentials=credentials)
    _vision_configured = True
    logger.info("Google Vision client initialized.")


def is_vision_configured() -> bool:
    return _vision_configured


def _run_ocr(client, file_bytes: bytes, filename: str):
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access."""
    processed = _preprocess_image(file_bytes) if not filename.lower().endswith(".pdf") else file_bytes
    image = {"content": processed}
    response = client.document_text_detection(image=image, timeout=25)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation.text


def extract_text_from_resume(file_bytes: bytes, filename: str) -> dict:
    """Returns {"text": str|None, "mode": "real"|"error", "detail": str|None}."""
    if not is_vision_configured() or _vision_client is None:
        logger.warning("Google Vision not configured — cannot process %s", filename)
        return {"text": None, "mode": "error", "detail": "OCR is not configured on this server."}

    try:
        import eventlet.tpool

        text = eventlet.tpool.execute(_run_ocr, _vision_client, file_bytes, filename)
        return {"text": text, "mode": "real", "detail": None}
    except Exception as exc:  # noqa: BLE001
        logger.error("Vision API extraction failed for %s: %s", filename, exc)
        return {"text": None, "mode": "error", "detail": str(exc)}
