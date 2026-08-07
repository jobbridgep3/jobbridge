"""Image validation for the AI assistant's camera/visual Q&A feature.

Deliberately separate from document_extraction.py (PDF/DOCX/TXT) and
storage_service.py's ALLOWED_DOCUMENT_EXTENSIONS (used by every other upload route in
the app) — this module is scoped to chat image uploads only.

Groq's vision-capable model (qwen/qwen3.6-27b — confirmed the only Groq model with
vision support) accepts a base64 data URI directly, so no server-side image
processing/resizing is needed beyond validating type and size before encoding.

The mimetype used for the data URI comes from magic-byte detection, not the client's
claimed Content-Type or filename extension — "don't trust the extension alone," the
same principle document_extraction.py's PDF/DOCX validation already follows.
"""

import base64

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
# 5MB — conservative relative to Groq's 20MB per-request ceiling, kept consistent with
# the document-upload limit from Phase 4 for a predictable, familiar size across the app.
MAX_SIZE_BYTES = 5 * 1024 * 1024


def detect_mimetype(image_bytes: bytes) -> str | None:
    if image_bytes[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate(image_bytes: bytes, filename: str) -> str | None:
    """Returns an error message if the image is invalid, else None."""
    if not image_bytes:
        return "No image was provided."
    if len(image_bytes) > MAX_SIZE_BYTES:
        return "Image is too large. Maximum size is 5MB."
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return "Only JPEG, PNG, and WEBP images are allowed."
    if detect_mimetype(image_bytes) is None:
        return "This file doesn't look like a valid JPEG, PNG, or WEBP image."
    return None


def to_data_uri(image_bytes: bytes, mimetype: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{mimetype};base64,{encoded}"
