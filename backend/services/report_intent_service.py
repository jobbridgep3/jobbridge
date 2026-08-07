"""Detects when a chat message is asking Job Bot to GENERATE a downloadable report file,
rather than just answer in text. Mirrors faq_lookup.py's pattern exactly: a
deterministic, keyword-based match, never an LLM decision — the whole point of this
feature is a guaranteed-safe, whitelisted-query path (see report_generation_service.py)
that bypasses freeform AI-generated content for the actual data. A non-match falls
through to the normal chat pipeline, same as an FAQ non-match does today.
"""

from services.report_generation_service import REPORT_CATALOG

_GENERATION_TRIGGERS = ["generate", "gawan", "i-export", "export", "pa-generate", "download"]

_FORMAT_KEYWORDS = {
    "pdf": ["pdf"],
    "docx": ["docx", "word doc", " word"],
    "txt": ["txt", "text file", "plain text"],
    "xlsx": ["excel", "xlsx", "spreadsheet"],
}

# Bare stems, not suffix-locked phrases like "applicant ko" — a plural ("applicants ko")
# doesn't contain that as a substring (the 's' lands before the space, not after "ko"),
# so a stem match is what's actually robust to natural pluralization/word order rather
# than something that only looks more precise. Order matters only in that the first
# matching key wins within one role's whitelist — there's no cross-role ambiguity since
# generate_report_file() re-checks role membership independently and a role only ever
# has entries from its own whitelist to match against.
_REPORT_KEYWORDS = {
    "my_applications": ["my application", "application ko", "aking application", "application"],
    "my_referrals": ["referral letter", "referral ko", "aking referral", "referral"],
    "my_employment": ["employment history", "employment ko", "trabaho history"],
    "my_vacancies": ["my job posting", "my vacanc", "posting ko", "trabaho ko"],
    "my_applicants": ["applicant", "aplikante"],
    "my_hires": ["hire", "na-hire"],
    "dashboard_summary": ["dashboard summary", "system summary", "system statistics"],
    "audit_trail": ["audit trail", "audit log"],
    "program_applications": ["program application", "spes application", "dilp application", "owwa application"],
    "jobseekers_list": ["jobseeker", "job seeker"],
    "employers_list": ["employer list", "list ng employer", "kumpanya", "company list"],
    "vacancies_list": ["vacanc", "job posting", "trabaho"],
}

_DATE_PHRASES = ("this week", "this month", "today", "linggong ito", "buwang ito", "ngayong linggo", "ngayong buwan")


def _detect_format(lower: str) -> str:
    for fmt, keywords in _FORMAT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return fmt
    return "xlsx"  # most common ask for "list" data, matches the plan's default


def _detect_date_from(lower: str):
    matched_phrase = next((phrase for phrase in _DATE_PHRASES if phrase in lower), None)
    if not matched_phrase:
        return None
    try:
        import dateparser

        parsed = dateparser.parse(matched_phrase, settings={"PREFER_DATES_FROM": "past"})
        return parsed
    except Exception:  # noqa: BLE001 — a date-parsing failure should never break report generation
        return None


def detect(message: str, role: str) -> dict | None:
    """Returns {"report_key", "format", "date_from"} when the message is a generation
    request for a report this role is actually allowed to generate — else None."""
    lower = message.lower()
    if not any(trigger in lower for trigger in _GENERATION_TRIGGERS):
        return None

    report_key = None
    for key, keywords in _REPORT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            entry = REPORT_CATALOG.get(key)
            if entry and role in entry["roles"]:
                report_key = key
                break
    if not report_key:
        return None

    return {"report_key": report_key, "format": _detect_format(lower), "date_from": _detect_date_from(lower)}
