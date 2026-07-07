"""spaCy NLP + regex parsing of OCR'd resume text into structured profile fields.

This runs fully for real (no external credentials needed).
"""

import logging
import re

logger = logging.getLogger(__name__)

_nlp = None

SKILL_KEYWORDS = [
    "customer service", "microsoft office", "excel", "word", "powerpoint", "data entry",
    "communication", "teamwork", "leadership", "sales", "marketing", "accounting",
    "bookkeeping", "python", "java", "javascript", "sql", "web development", "graphic design",
    "photoshop", "video editing", "social media", "carpentry", "welding", "electrical",
    "plumbing", "cooking", "baking", "driving", "typing", "cashiering", "inventory management",
    "warehousing", "housekeeping", "caregiving", "nursing", "teaching", "tutoring",
]

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}")


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("en_core_web_sm")
        except Exception as exc:  # noqa: BLE001
            logger.warning("spaCy model unavailable (%s) — falling back to regex-only parsing", exc)
            _nlp = False
    return _nlp


def preload_nlp_model() -> None:
    """Eagerly loads the spaCy model at app boot so the cost isn't paid inside a
    user's resume-upload request (a multi-second synchronous load on a cold worker
    was compounding the OCR worker-timeout issue).
    """
    _get_nlp()


def parse_resume_text(raw_text: str) -> dict:
    """Returns {full_name, contact_number, skills[], work_experiences[], educations[]}."""
    nlp = _get_nlp()

    full_name = None
    if nlp:
        doc = nlp(raw_text[:2000])
        persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
        if persons:
            full_name = persons[0]
    if not full_name:
        first_line = next((line.strip() for line in raw_text.splitlines() if line.strip()), None)
        full_name = first_line

    email_match = EMAIL_RE.search(raw_text)
    phone_match = PHONE_RE.search(raw_text)

    found_skills = sorted({kw.title() for kw in SKILL_KEYWORDS if kw in raw_text.lower()})

    work_experiences = _extract_section(raw_text, "WORK EXPERIENCE", "EDUCATION")
    educations = _extract_section(raw_text, "EDUCATION", None)

    return {
        "full_name": full_name,
        "email": email_match.group(0) if email_match else None,
        "contact_number": phone_match.group(0) if phone_match else None,
        "skills": found_skills,
        "work_experience_lines": work_experiences,
        "education_lines": educations,
    }


def _extract_section(text: str, start_marker: str, end_marker: str | None) -> list[str]:
    upper = text.upper()
    start = upper.find(start_marker)
    if start == -1:
        return []
    start += len(start_marker)
    end = upper.find(end_marker, start) if end_marker else -1
    chunk = text[start:end if end != -1 else None]
    return [line.strip("-• \t") for line in chunk.splitlines() if line.strip()]
