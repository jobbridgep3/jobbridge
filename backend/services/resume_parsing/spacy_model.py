"""Centralized spaCy model loading, shared by the resume_parsing field extractors."""

import logging

logger = logging.getLogger(__name__)

_nlp = None


def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("en_core_web_sm")
        except Exception as exc:  # noqa: BLE001
            logger.warning("spaCy model unavailable (%s) — name extraction will stay conservative", exc)
            _nlp = False
    return _nlp


def preload_nlp_model() -> None:
    """Eagerly loads the spaCy model at app boot so the cost isn't paid inside a
    user's resume-upload request (a multi-second synchronous load on a cold worker
    was compounding the OCR worker-timeout issue)."""
    get_nlp()
