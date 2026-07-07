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

PDFs and images are NOT the same API call. Vision's Image proto (used by
document_text_detection) has no mime_type field and its image-annotation backend only
decodes raster formats (JPEG/PNG/GIF/BMP/WEBP/RAW/ICO) — it is not designed to succeed
on raw PDF bytes. Sending a PDF there previously produced a deterministic
"504 Deadline Exceeded" on every PDF upload (a fixed defect, not a flaky network
issue). PDFs go through batch_annotate_files() instead, whose InputConfig has a real
mime_type field for "application/pdf".

The client uses transport="rest" (plain HTTPS via google-auth, not gRPC). After fixing
the PDF-vs-image API mismatch above, BOTH file types still failed in production with
"504 Deadline Exceeded" — including immediately after a client rebuild, which rules out
a merely-stale gRPC channel. gRPC's persistent HTTP/2 channel apparently never
completes a round trip from Render's network to Google's servers; a plain REST request
(a single ordinary HTTPS call, no long-lived channel to negotiate) does not depend on
that same network path succeeding.

Both request methods (REST or gRPC) are still synchronous, blocking calls, and REST's
underlying `requests`/urllib3 socket I/O still is not covered by eventlet's
monkey_patch() in a way that's safe to call directly from a greenlet (do not assume
otherwise) — calling it directly on the eventlet worker's single real OS thread would
freeze every other concurrent request (and Socket.IO) until it returns or gunicorn's
timeout kills the worker. extract_text_from_resume() offloads the blocking work via
eventlet.tpool.execute() to avoid this, and retries once (rebuilding the client) on a
transient DeadlineExceeded/ServiceUnavailable — general defense-in-depth, not a
substitute for using the right transport/API.

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


def _build_vision_client(config) -> None:
    global _vision_client, _vision_configured

    credentials = _load_credentials(config)
    if credentials is None:
        _vision_client = None
        _vision_configured = False
        return

    from google.cloud import vision

    # transport="rest" (plain HTTPS via google-auth's requests transport) instead of
    # the default gRPC. Root cause of the production 504 DEADLINE_EXCEEDED on every
    # single Vision call (image AND PDF alike, and unaffected by rebuilding the
    # client) — gRPC's persistent HTTP/2 channel never completed a round trip from
    # Render's network to Google's servers, while a fresh REST call is a single plain
    # HTTPS request/response with no long-lived channel to negotiate or go stale.
    _vision_client = vision.ImageAnnotatorClient(credentials=credentials, transport="rest")
    _vision_configured = True


def init_vision_client(app) -> None:
    """Eagerly builds and caches the Vision client at app boot (inside an app context).

    Must run with app context available (reads app.config directly here rather than via
    current_app, so it can also be called from outside a request/app-context push).
    """
    _build_vision_client(app.config)
    if _vision_configured:
        logger.info("Google Vision client initialized.")
    else:
        logger.warning("Google Vision not configured — OCR will return errors until credentials are set.")


def is_vision_configured() -> bool:
    return _vision_configured


def _run_ocr_image(client, file_bytes: bytes):
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access."""
    processed = _preprocess_image(file_bytes)
    response = client.document_text_detection(image={"content": processed}, timeout=25)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return response.full_text_annotation.text


def _run_ocr_pdf(client, pdf_bytes: bytes):
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access.

    document_text_detection() is for single raster images only; PDFs require the
    separate batch_annotate_files() API, whose InputConfig actually has a mime_type
    field. Vision's synchronous file-annotation API caps at 5 pages per request —
    resumes are virtually always 1-2 pages, so this is not a practical limitation.
    """
    from google.cloud import vision

    file_request = {
        "input_config": {"content": pdf_bytes, "mime_type": "application/pdf"},
        "features": [{"type_": vision.Feature.Type.DOCUMENT_TEXT_DETECTION}],
        "pages": [1, 2, 3, 4, 5],
    }
    batch_response = client.batch_annotate_files(requests=[file_request], timeout=60)
    file_response = batch_response.responses[0]

    if file_response.error.message:
        raise RuntimeError(file_response.error.message)

    page_texts = []
    page_errors = []
    for page_response in file_response.responses:
        if page_response.error.message:
            page_errors.append(page_response.error.message)
            continue
        page_texts.append(page_response.full_text_annotation.text)

    if not page_texts:
        detail = "; ".join(page_errors) if page_errors else "no page responses were returned"
        raise RuntimeError(f"All pages failed OCR: {detail}")

    return "\n".join(page_texts)


def extract_text_from_resume(file_bytes: bytes, filename: str) -> dict:
    """Returns {"text": str|None, "mode": "real"|"error", "detail": str|None}."""
    if not is_vision_configured() or _vision_client is None:
        logger.warning("Google Vision not configured — cannot process %s", filename)
        return {"text": None, "mode": "error", "detail": "OCR is not configured on this server."}

    import eventlet.tpool
    from flask import current_app
    from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable

    is_pdf = filename.lower().endswith(".pdf")
    run = _run_ocr_pdf if is_pdf else _run_ocr_image

    for attempt in range(2):
        try:
            text = eventlet.tpool.execute(run, _vision_client, file_bytes)
            return {"text": text, "mode": "real", "detail": None}
        except (DeadlineExceeded, ServiceUnavailable) as exc:
            if attempt == 0:
                # The long-lived singleton channel may have gone stale during an idle
                # period — rebuild it once (safe here: this function runs in the
                # request greenlet, which has real app context) and retry exactly once.
                logger.warning("Vision call failed (%s) for %s — rebuilding client and retrying once", exc, filename)
                _build_vision_client(current_app.config)
                continue
            logger.error("Vision API extraction failed for %s after retry: %s", filename, exc)
            return {"text": None, "mode": "error", "detail": str(exc)}
        except Exception as exc:  # noqa: BLE001
            logger.error("Vision API extraction failed for %s: %s", filename, exc)
            return {"text": None, "mode": "error", "detail": str(exc)}
