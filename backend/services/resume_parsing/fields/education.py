"""Education entry extraction, scoped to the isolated Education section.

`attainment_level` is only ever set to one of the exact ATTAINMENT_LEVELS enum
values the schema accepts, or left None — never an unmapped free-text guess, since
these rows are inserted directly (bypassing EducationSchema's OneOf validator) and a
stray value would only surface as a confusing 400 on some later, unrelated save.
"""

import re
from datetime import date

_YEAR_RE = re.compile(r"\b(19[6-9]\d|20\d{2})\b")
_SCHOOL_KEYWORDS = ("university", "college", "school", "institute", "academy", "polytechnic")

# Checked in order — more advanced attainment keywords take precedence when a line
# happens to mention more than one (e.g. "college" appearing inside a vocational blurb).
_ATTAINMENT_KEYWORDS = [
    (("post-graduate", "postgraduate", "master", "masters", "phd", "doctorate"), "Post-Graduate"),
    (("bachelor", "b.s.", "b.a.", "undergraduate"), "College"),
    (("vocational", "tesda", "nc ii", "nc-ii", "tvet"), "Vocational/TVET"),
    (("senior high", "shs", "grade 11", "grade 12"), "Senior High School"),
    (("high school", "secondary"), "High School"),
    (("elementary", "primary"), "Elementary"),
    (("college",), "College"),
]


def _extract_school(line: str) -> str:
    return _YEAR_RE.sub("", line).strip(" -–—,()")


def _extract_year(chunk: str) -> int | None:
    current_year = date.today().year
    years = [int(y) for y in _YEAR_RE.findall(chunk)]
    valid = [y for y in years if 1960 <= y <= current_year + 1]
    return max(valid) if valid else None


def _extract_attainment(chunk: str) -> str | None:
    lowered = chunk.lower()
    for keywords, level in _ATTAINMENT_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return level
    return None


def _extract_degree(lines_after_anchor: list[str]) -> str | None:
    for line in lines_after_anchor:
        candidate = line.strip()
        if candidate and not _YEAR_RE.fullmatch(candidate):
            return candidate
    return None


def extract_educations(section_text: str) -> list[dict]:
    if not section_text:
        return []

    lines = [line.strip(" -•*\t") for line in section_text.splitlines() if line.strip()]
    lines = [line for line in lines if line]
    # School-name lines anchor entries; a bare year on its own line (e.g. right below
    # the school name) is NOT an anchor by itself — it belongs to whichever school
    # entry precedes it. Only fall back to year-only anchors if no school-keyword
    # line was found anywhere in the section at all.
    anchors = [i for i, line in enumerate(lines) if any(kw in line.lower() for kw in _SCHOOL_KEYWORDS)]
    if not anchors:
        anchors = [i for i, line in enumerate(lines) if _YEAR_RE.search(line)]

    entries = []
    for n, idx in enumerate(anchors):
        end = anchors[n + 1] if n + 1 < len(anchors) else len(lines)
        chunk = "\n".join(lines[idx:end])
        school = _extract_school(lines[idx])
        if not school:
            continue  # school is NOT NULL on the model — never insert a blank one
        entries.append({
            "school": school,
            "degree": _extract_degree(lines[idx + 1 : end]),
            "graduation_year": _extract_year(chunk),
            "attainment_level": _extract_attainment(chunk),
        })
    return entries
