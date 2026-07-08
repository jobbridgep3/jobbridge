"""Header-synonym section segmentation.

Replaces a single hardcoded `str.find("WORK EXPERIENCE")...find("EDUCATION")` slice
with detection of whichever section headers actually appear, in whatever order they
appear in — real resumes don't reliably put Work Experience before Education, and use
many header synonyms ("Employment History", "Core Competencies", etc.).
"""

import re

SECTION_HEADERS: dict[str, list[str]] = {
    "summary": ["summary", "objective", "profile", "about me", "career objective"],
    "experience": [
        "work experience", "experience", "employment history",
        "professional experience", "work history", "career history",
    ],
    "education": ["education", "educational background", "academic background"],
    "skills": [
        "skills", "technical skills", "core competencies", "key skills",
        "skills & competencies", "skills and competencies",
    ],
    "certifications": [
        "certifications", "certificates", "certification",
        "trainings", "training", "seminars", "trainings and seminars",
    ],
    "languages": ["languages", "language proficiency", "languages spoken"],
    "contact": [
        "contact", "contact information", "contact details",
        "personal information", "personal details",
    ],
}

_MAX_HEADER_WORDS = 5


def _normalize(line: str) -> str:
    line = line.strip().strip("-•*:.").strip()
    return re.sub(r"\s+", " ", line).lower()


def _match_header(line: str) -> str | None:
    norm = _normalize(line)
    if not norm or len(norm.split()) > _MAX_HEADER_WORDS:
        return None
    for key, synonyms in SECTION_HEADERS.items():
        if norm in synonyms:
            return key
    return None


def preamble(text: str) -> str:
    """Returns the lines before the first detected section header — the
    name/contact/address block conventionally at the top of a resume, before any
    named section (Skills, Experience, etc.) begins. Used to scope address/name
    extraction so a place name that happens to appear inside a company name deeper
    in the document (e.g. "SM Pila") is never mistaken for the jobseeker's address."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if _match_header(line):
            return "\n".join(lines[:i])
    return text


def segment_sections(text: str) -> dict[str, str]:
    """Returns {section_key: raw_text_chunk} for whichever sections were found. A key
    absent from the dict means no matching header was found — callers must treat that
    as 'no data available', not as an error."""
    lines = text.splitlines()
    headers = [(i, key) for i, line in enumerate(lines) if (key := _match_header(line))]

    sections: dict[str, str] = {}
    for idx, (line_idx, key) in enumerate(headers):
        start = line_idx + 1
        end = headers[idx + 1][0] if idx + 1 < len(headers) else len(lines)
        chunk = "\n".join(lines[start:end]).strip()
        if chunk and key not in sections:
            sections[key] = chunk
    return sections
