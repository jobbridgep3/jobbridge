"""Resume OCR extraction.

Real path: Pillow preprocesses the image -> Google Vision API extracts text.
Stub path (no GOOGLE_APPLICATION_CREDENTIALS configured): returns a clearly-labeled
mock extraction so the rest of the pipeline (spaCy parsing, profile auto-fill) can be
built and tested end-to-end without a Google Cloud account. Swapping in a real
service-account JSON via GOOGLE_APPLICATION_CREDENTIALS requires no code changes.
"""

import io
import logging
import os

from flask import current_app
from PIL import Image

logger = logging.getLogger(__name__)

MOCK_RESUME_TEXT = """[MOCK OCR OUTPUT — set GOOGLE_APPLICATION_CREDENTIALS to enable real Vision API extraction]
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
    return bool(current_app.config.get("GOOGLE_APPLICATION_CREDENTIALS") and os.path.exists(
        current_app.config["GOOGLE_APPLICATION_CREDENTIALS"]
    ))


def extract_text_from_resume(file_bytes: bytes, filename: str) -> str:
    if not is_vision_configured():
        logger.warning("Google Vision not configured — returning mock OCR text for %s", filename)
        return MOCK_RESUME_TEXT

    try:
        from google.cloud import vision

        processed = _preprocess_image(file_bytes) if not filename.lower().endswith(".pdf") else file_bytes
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=processed)
        response = client.document_text_detection(image=image)
        if response.error.message:
            raise RuntimeError(response.error.message)
        return response.full_text_annotation.text
    except Exception as exc:  # noqa: BLE001
        logger.error("Vision API extraction failed, falling back to mock: %s", exc)
        return MOCK_RESUME_TEXT
