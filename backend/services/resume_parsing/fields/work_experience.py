"""Work-experience entry extraction, scoped to the isolated Experience section.

An entry is only created when a date-range line anchors it (the confidence signal —
see module docstring pattern used throughout resume_parsing) — unlike the old parser,
which dumped every raw line in the section as a new WorkExperience row with an empty
company and the whole line jammed into `position`.
"""

import re
from datetime import date

import dateparser

_DATE_RANGE_RE = re.compile(
    r"\b((?:19|20)\d{2}|present|current)\b\s*(?:-|–|—|to)\s*\b((?:19|20)\d{2}|present|current)\b",
    re.IGNORECASE,
)


def _parse_one_date(raw: str) -> date | None:
    parsed = dateparser.parse(raw, settings={"PREFER_DAY_OF_MONTH": "first"})
    return parsed.date() if parsed else None


def _parse_date_range(match: re.Match) -> tuple[date | None, date | None]:
    start_raw, end_raw = match.group(1), match.group(2)
    start = _parse_one_date(start_raw)
    end = None if end_raw.lower() in ("present", "current") else _parse_one_date(end_raw)
    return start, end


def _split_company_position(line: str) -> tuple[str, str]:
    for sep in (" at ", " - ", " – ", " — ", ","):
        if sep in line:
            left, right = line.split(sep, 1)
            if sep.strip() == "at":  # "Position at Company" — the common PH resume convention
                return right.strip(), left.strip()
            return left.strip(), right.strip()
    return "", line.strip()  # fallback: whole line as position, matches prior behavior


def extract_work_experiences(section_text: str) -> list[dict]:
    if not section_text:
        return []

    lines = [line.strip(" -•*\t") for line in section_text.splitlines() if line.strip()]
    lines = [line for line in lines if line]
    anchors = [i for i, line in enumerate(lines) if _DATE_RANGE_RE.search(line)]
    if not anchors:
        return []
    anchor_set = set(anchors)

    # When a date range sits on its own line, the title lives on the PRECEDING line —
    # track which line that is so it can be excluded from the description below
    # (otherwise the next entry's title line leaks into the previous entry's
    # description, since both fall between the same pair of date-range anchors).
    title_src_by_anchor: dict[int, int | None] = {}
    for idx in anchors:
        match = _DATE_RANGE_RE.search(lines[idx])
        remainder = (lines[idx][: match.start()] + lines[idx][match.end() :]).strip(" -–—,()")
        if remainder:
            title_src_by_anchor[idx] = idx
        elif idx - 1 >= 0 and (idx - 1) not in anchor_set:
            title_src_by_anchor[idx] = idx - 1
        else:
            title_src_by_anchor[idx] = None
    consumed_title_lines = {v for v in title_src_by_anchor.values() if v is not None}

    entries = []
    for n, idx in enumerate(anchors):
        date_match = _DATE_RANGE_RE.search(lines[idx])
        remainder = (lines[idx][: date_match.start()] + lines[idx][date_match.end() :]).strip(" -–—,()")
        title_src = title_src_by_anchor[idx]
        title_line = remainder if remainder else (lines[title_src] if title_src is not None else "")
        company, position = _split_company_position(title_line)
        start_date, end_date = _parse_date_range(date_match)

        desc_end = anchors[n + 1] if n + 1 < len(anchors) else len(lines)
        description = "\n".join(
            lines[i] for i in range(idx + 1, desc_end) if i not in consumed_title_lines
        ).strip()

        entries.append({
            "company": company,
            "position": position,
            "start_date": start_date,
            "end_date": end_date,
            "description": description or None,
        })
    return entries
