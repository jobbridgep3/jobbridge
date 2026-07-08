"""Address extraction via a PH/Laguna gazetteer lookup rather than a positional guess.

Only ever writes a value when a known municipality or province name is actually
found in the text — never falls back to "some capitalized line near the top", which
is exactly the kind of ungrounded guess that produces wrong addresses.
"""

import re

from .. import gazetteer
from ..sections import preamble


def _find_token(text: str, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if re.search(rf"\b{re.escape(candidate)}\b", text, re.IGNORECASE):
            return candidate
    return None


def _find_adjacent_barangay(text: str, municipality: str) -> str | None:
    # Only trust a barangay match found on the same line as the municipality hit —
    # barangay names alone are too generic a word to confidently match elsewhere.
    for line in text.splitlines():
        if re.search(rf"\b{re.escape(municipality)}\b", line, re.IGNORECASE):
            barangay = _find_token(line, gazetteer.PILA_BARANGAYS)
            if barangay:
                return barangay
    return None


def extract_address(sections: dict, full_text: str) -> dict | None:
    # Scoped to the contact section and the document's preamble (everything before
    # the first section header) — NOT the whole document. Resumes routinely mention
    # place names inside company names deeper in the text (e.g. "Cashier at SM
    # Pila"), which would otherwise be mistaken for the jobseeker's own address.
    haystack = (sections.get("contact") or "") + "\n" + preamble(full_text)

    municipality = _find_token(haystack, gazetteer.LAGUNA_MUNICIPALITIES)
    if municipality:
        result = {"barangay": None, "municipality": municipality, "province": "Laguna"}
        if municipality.lower() == "pila":
            result["barangay"] = _find_adjacent_barangay(haystack, municipality)
        return result

    province = _find_token(haystack, gazetteer.PH_PROVINCES)
    if province:
        return {"barangay": None, "municipality": None, "province": province}

    return None
