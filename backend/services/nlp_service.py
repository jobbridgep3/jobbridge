"""Thin backward-compatible facade over services.resume_parsing.

Kept as a separate module (rather than folding callers over to the new path)
because services/dashboard_service.py imports SKILL_KEYWORDS from this exact path
for an unrelated vacancy-analytics keyword-frequency widget, not for resume parsing.
"""

from .resume_parsing import parse_resume_text  # noqa: F401
from .resume_parsing.fields.skills import SKILL_KEYWORDS  # noqa: F401
from .resume_parsing.spacy_model import preload_nlp_model  # noqa: F401
