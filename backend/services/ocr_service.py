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


def _block_text(block) -> str:
    """Walks a block's paragraphs/words/symbols, honoring Vision's DetectedBreak types
    to reconstruct that block's text with correct spacing/line breaks — scoped per
    block so reorder_blocks() (services/resume_parsing/layout.py) never has to
    re-split an already-flattened string."""
    from google.cloud import vision

    Break = vision.TextAnnotation.DetectedBreak.BreakType
    parts = []
    for paragraph in block.paragraphs:
        for word in paragraph.words:
            for symbol in word.symbols:
                parts.append(symbol.text)
                break_type = symbol.property.detected_break.type_
                if break_type in (Break.SPACE, Break.SURE_SPACE):
                    parts.append(" ")
                elif break_type in (Break.EOL_SURE_SPACE, Break.LINE_BREAK):
                    parts.append("\n")
                elif break_type == Break.HYPHEN:
                    parts.append("-")
    return "".join(parts).strip()


def _page_to_dict(full_text_annotation) -> dict:
    """Converts one Vision full_text_annotation into a plain-dict layout structure —
    must be a pure dict (not proto objects), since this crosses the eventlet.tpool
    boundary and gets stored/reordered outside the proto's own runtime. TABLE/
    PICTURE/RULER/BARCODE blocks are skipped (table-cell extraction is a deliberate
    v1 scoping decision, not an oversight — see resume_parsing/layout.py)."""
    from google.cloud import vision

    pages = []
    for page in full_text_annotation.pages:
        blocks = []
        for block in page.blocks:
            if block.block_type != vision.Block.BlockType.TEXT:
                continue
            text = _block_text(block)
            if not text:
                continue

            # document_text_detection() (images) populates pixel `vertices`;
            # batch_annotate_files() (PDFs) instead only populates fractional
            # `normalized_vertices` (0-1) — scale those by the page's pixel
            # dimensions so both code paths produce comparable coordinates.
            vertices = block.bounding_box.vertices
            if vertices:
                xs = [v.x for v in vertices]
                ys = [v.y for v in vertices]
            else:
                xs = [v.x * page.width for v in block.bounding_box.normalized_vertices]
                ys = [v.y * page.height for v in block.bounding_box.normalized_vertices]
            if not xs or not ys:
                continue

            blocks.append({
                "text": text,
                "x0": min(xs), "y0": min(ys), "x1": max(xs), "y1": max(ys),
                "confidence": block.confidence,
            })
        pages.append({"width": page.width, "height": page.height, "blocks": blocks})
    return {"pages": pages, "full_text": full_text_annotation.text}


def _run_ocr_image(client, file_bytes: bytes) -> dict:
    """Runs entirely inside eventlet.tpool's real OS thread — no Flask context access."""
    processed = _preprocess_image(file_bytes)
    response = client.document_text_detection(image={"content": processed}, timeout=25)
    if response.error.message:
        raise RuntimeError(response.error.message)
    return _page_to_dict(response.full_text_annotation)


def _run_ocr_pdf(client, pdf_bytes: bytes) -> dict:
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
    # 30s, not 60s: extract_text_from_resume() retries once on timeout, so 60s here
    # would let the worst case (timeout, rebuild, retry, timeout again) reach ~120s —
    # past gunicorn's --timeout 90 (Procfile) and likely past Render's edge/proxy
    # timeout too. 30s x 2 keeps the worst case at ~60s, comfortably under both.
    batch_response = client.batch_annotate_files(requests=[file_request], timeout=30)
    file_response = batch_response.responses[0]

    if file_response.error.message:
        raise RuntimeError(file_response.error.message)

    all_pages = []
    page_texts = []
    page_errors = []
    for page_response in file_response.responses:
        if page_response.error.message:
            page_errors.append(page_response.error.message)
            continue
        page_dict = _page_to_dict(page_response.full_text_annotation)
        all_pages.extend(page_dict["pages"])
        page_texts.append(page_dict["full_text"])

    if not page_texts:
        detail = "; ".join(page_errors) if page_errors else "no page responses were returned"
        raise RuntimeError(f"All pages failed OCR: {detail}")

    return {"pages": all_pages, "full_text": "\n".join(page_texts)}


def extract_text_from_resume(file_bytes: bytes, filename: str) -> dict:
    """Returns {"layout": dict|None, "text": str|None, "mode": "real"|"error", "detail": str|None}.

    "layout" (per-page block geometry) is the primary input for field-mapping via
    services/resume_parsing — it preserves enough structure to reconstruct correct
    reading order for two-column resumes. "text" is the flattened fallback, kept for
    `profile.resume_raw_text` storage and the staff "View OCR Text" dialog.
    """
    if not is_vision_configured() or _vision_client is None:
        logger.warning("Google Vision not configured — cannot process %s", filename)
        return {"layout": None, "text": None, "mode": "error", "detail": "OCR is not configured on this server."}

    import eventlet.tpool
    from flask import current_app
    from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable

    is_pdf = filename.lower().endswith(".pdf")
    run = _run_ocr_pdf if is_pdf else _run_ocr_image

    for attempt in range(2):
        try:
            layout = eventlet.tpool.execute(run, _vision_client, file_bytes)
            return {"layout": layout, "text": layout["full_text"], "mode": "real", "detail": None}
        except (DeadlineExceeded, ServiceUnavailable) as exc:
            if attempt == 0:
                # The long-lived singleton channel may have gone stale during an idle
                # period — rebuild it once (safe here: this function runs in the
                # request greenlet, which has real app context) and retry exactly once.
                logger.warning("Vision call failed (%s) for %s — rebuilding client and retrying once", exc, filename)
                _build_vision_client(current_app.config)
                continue
            logger.error("Vision API extraction failed for %s after retry: %s", filename, exc)
            return {"layout": None, "text": None, "mode": "error", "detail": str(exc)}
        except Exception as exc:  # noqa: BLE001
            logger.error("Vision API extraction failed for %s: %s", filename, exc)
            return {"layout": None, "text": None, "mode": "error", "detail": str(exc)}
