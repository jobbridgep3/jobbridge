"""Date-of-birth extraction — explicit-label-only. A bare date anywhere else in the
document (e.g. inside a work-experience date range) is never mistaken for a DOB;
only a line with an explicit "Date of Birth"/"DOB"/"Birth Date" label is considered.
"""

from datetime import date

import dateparser

from ._regex import DOB_LABEL_RE

_MIN_AGE, _MAX_AGE = 15, 100


def extract_dob(text: str) -> date | None:
    for line in text.splitlines():
        match = DOB_LABEL_RE.search(line)
        if not match:
            continue

        parsed = dateparser.parse(match.group(1).strip(), settings={"PREFER_DATES_FROM": "past"})
        if not parsed:
            continue

        dob = parsed.date()
        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if _MIN_AGE <= age <= _MAX_AGE:
            return dob
    return None
