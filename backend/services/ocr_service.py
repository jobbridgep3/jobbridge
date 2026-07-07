"""Resume OCR extraction.

Real path: Pillow preprocesses the image -> Google Vision API extracts text.
Stub path (no credentials configured at all): returns a clearly-labeled mock
extraction so the rest of the pipeline (spaCy parsing, profile auto-fill) can be built
and tested end-to-end without a Google Cloud account.

Credentials can come from either:
  - GOOGLE_APPLICATION_CREDENTIALS_JSON — base64-encoded service-account JSON key.
    Used in production (e.g. Render), where a git-ignored key file can't be placed on
    disk since builds start from a fresh git clone.
  - GOOGLE_APPLICATION_CREDENTIALS — a file path to the same JSON key. Used in local
    dev, where the file exists on disk (see backend/credentials/).
Both are explicitly loaded into a google.oauth2 Credentials object and passed to the
Vision client — the client never relies on ambient Application Default Credentials, so
behavior doesn't depend on process-start-time OS environment state.

Callers must check the `mode` in the returned dict rather than assuming success: a
real Vision failure (auth, billing, quota, network) is reported as `mode: "error"`, not
silently downgraded to mock data — mock text with fabricated identity details must
never be merged into a real user's profile as if it were a genuine extraction.
"""

import base64
import io
import json
import logging

from flask import current_app
from PIL import Image

logger = logging.getLogger(__name__)

MOCK_RESUME_TEXT = """[MOCK OCR OUTPUT — Google Vision is not configured in this environment]
Juan Dela Cruz
Pila, Laguna | 09171234567 | juan.delacruz@example.com

SKILLS
Customer Service, Microsoft Office, Data Entry, Communication, Teamwork

WORK EXPERIENCE
Sales Associate — ABC Retail Corp (2022 - 2024)
Cashier — XYZ Store (2021 - 2022)

EDUCATION
Bachelor of Science in Information Technology — Laguna State Polytechnic University (2025)
"""


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


def is_vision_configured() -> bool:
    """Cheap presence check for either credential source — mirrors _load_credentials()."""
    cfg = current_app.config
    if cfg.get("GOOGLE_APPLICATION_CREDENTIALS_JSON"):
        return True
    import os

    path = cfg.get("GOOGLE_APPLICATION_CREDENTIALS")
    return bool(path and os.path.exists(path))


def _load_credentials():
    """Builds an explicit google.oauth2 Credentials object from whichever source is set."""
    import os

    from google.oauth2 import service_account

    cfg = current_app.config
    json_b64 = cfg.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if json_b64:
        info = json.loads(base64.b64decode(json_b64))
        return service_account.Credentials.from_service_account_info(info)

    path = cfg.get("GOOGLE_APPLICATION_CREDENTIALS")
    if path and os.path.exists(path):
        return service_account.Credentials.from_service_account_file(path)

    return None


def extract_text_from_resume(file_bytes: bytes, filename: str) -> dict:
    """Returns {"text": str|None, "mode": "real"|"mock"|"error", "detail": str|None}."""
    if not is_vision_configured():
        logger.warning("Google Vision not configured — returning mock OCR text for %s", filename)
        return {"text": MOCK_RESUME_TEXT, "mode": "mock", "detail": None}

    try:
        from google.cloud import vision

        credentials = _load_credentials()
        processed = _preprocess_image(file_bytes) if not filename.lower().endswith(".pdf") else file_bytes
        client = vision.ImageAnnotatorClient(credentials=credentials)
        image = vision.Image(content=processed)
        response = client.document_text_detection(image=image)
        if response.error.message:
            raise RuntimeError(response.error.message)
        return {"text": response.full_text_annotation.text, "mode": "real", "detail": None}
    except Exception as exc:  # noqa: BLE001
        logger.error("Vision API extraction failed for %s: %s", filename, exc)
        return {"text": None, "mode": "error", "detail": str(exc)}
