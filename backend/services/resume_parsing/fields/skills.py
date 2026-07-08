"""Skill extraction — scoped to the isolated Skills section only (never the whole
document, which is why skills used to bleed into/from work experience), using
word-boundary matching (never a bare substring test, which is why e.g. "sql" could
previously match inside an unrelated word).
"""

import re

TECHNICAL_SKILL_KEYWORDS = [
    "microsoft office", "excel", "word", "powerpoint", "data entry", "python", "java",
    "javascript", "sql", "web development", "graphic design", "photoshop",
    "video editing", "social media", "carpentry", "welding", "electrical", "plumbing",
    "cooking", "baking", "driving", "typing", "cashiering", "inventory management",
    "warehousing", "housekeeping", "caregiving", "nursing", "teaching", "tutoring",
    "accounting", "bookkeeping", "sales", "marketing",
]

SOFT_SKILL_KEYWORDS = [
    "customer service", "communication", "teamwork", "leadership", "time management",
    "problem solving", "adaptability", "work ethic", "attention to detail",
    "multitasking", "interpersonal skills", "critical thinking", "patience", "flexibility",
]

# Back-compat: dashboard_service.py imports this flat name for an unrelated
# vacancy-analytics keyword-frequency widget, not for resume parsing.
SKILL_KEYWORDS = TECHNICAL_SKILL_KEYWORDS + SOFT_SKILL_KEYWORDS


def _match_keywords(chunk: str, keywords: list[str]) -> list[str]:
    return sorted({kw.title() for kw in keywords if re.search(rf"\b{re.escape(kw)}\b", chunk, re.IGNORECASE)})


def extract_skills(sections: dict) -> dict:
    chunk = sections.get("skills") or sections.get("summary") or ""
    return {
        "technical_skills": _match_keywords(chunk, TECHNICAL_SKILL_KEYWORDS),
        "soft_skills": _match_keywords(chunk, SOFT_SKILL_KEYWORDS),
    }
