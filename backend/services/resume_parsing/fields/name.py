"""Full-name extraction — requires two independent, corroborating signals before
writing a value; a bare heuristic guess (e.g. "first non-blank line") is never
returned, since that's the main source of wrong names in the old parser.
"""

import re

from ..spacy_model import get_nlp

_TITLE_LINE_RE = re.compile(r"^[A-Z][A-Za-z.'-]*(\s+[A-Z][A-Za-z.'-]*){1,3}$")
_LOOKAHEAD_LINES = 6
_CANDIDATE_LINES = 4


def _tokens_overlap(a: str, b: str) -> bool:
    ta, tb = set(a.lower().split()), set(b.lower().split())
    if not ta or not tb:
        return False
    # Allow an off-by-one token mismatch (e.g. a middle initial NER picks up or drops).
    return len(ta & tb) >= min(len(ta), len(tb)) - 1


def extract_name(reordered_text: str) -> str | None:
    lines = [line.strip() for line in reordered_text.splitlines()[:_LOOKAHEAD_LINES] if line.strip()]
    if not lines:
        return None

    # Signal 1 — formatting: a standalone, title-cased, 2-4 word line with no digits,
    # near the top of the document (where resumes conventionally put the name).
    candidates = [
        line for line in lines[:_CANDIDATE_LINES]
        if _TITLE_LINE_RE.match(line) and not any(ch.isdigit() for ch in line)
    ]
    if not candidates:
        return None
    candidate = candidates[0]

    # Signal 2 — spaCy NER: a PERSON entity that substantially overlaps the
    # formatting-based candidate. Without spaCy available, or without this
    # corroboration, there isn't enough confidence to write the value.
    nlp = get_nlp()
    if not nlp:
        return None

    doc = nlp("\n".join(lines))
    for ent in doc.ents:
        if ent.label_ == "PERSON" and _tokens_overlap(ent.text.strip(), candidate):
            return candidate
    return None
