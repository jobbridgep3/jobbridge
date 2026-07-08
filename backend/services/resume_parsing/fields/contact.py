"""Email and phone extraction. Email regex is already high-precision (a syntactic
match is inherently confident). Phone uses the `phonenumbers` library with a PH
region hint so PH landlines (e.g. Laguna's 049 area code) are recognized too, not
just the PH-mobile-only pattern the old regex was limited to — and so an invalid
sequence of digits is never mistaken for a real number.
"""

import re

import phonenumbers

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def extract_email(text: str) -> str | None:
    match = EMAIL_RE.search(text)
    return match.group(0) if match else None


def extract_phone(text: str) -> str | None:
    try:
        matches = phonenumbers.PhoneNumberMatcher(text, "PH")
    except Exception:  # noqa: BLE001
        return None

    for match in matches:
        if not phonenumbers.is_valid_number(match.number):
            continue
        national = phonenumbers.format_number(match.number, phonenumbers.PhoneNumberFormat.NATIONAL)
        digits = re.sub(r"\D", "", national)
        if not digits.startswith("0"):
            digits = "0" + digits  # PH NATIONAL format already includes the trunk 0; defensive fallback
        if 7 <= len(digits) <= 15:
            return digits
    return None
