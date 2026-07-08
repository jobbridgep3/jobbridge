"""Resume text -> structured profile-field mapping.

Each field extractor applies its own conservative "confident or blank" rule (see
each fields/*.py module's docstring) — this orchestrator just wires the isolated
section chunks (from sections.segment_sections) to the extractor that owns them, and
assembles the results. Callers should treat every value as already confidence-
filtered: a None/empty result means "leave this profile field alone," never "guess."
"""

from .fields.address import extract_address
from .fields.contact import extract_email, extract_phone
from .fields.dob import extract_dob
from .fields.education import extract_educations
from .fields.lists import extract_list_section
from .fields.name import extract_name
from .fields.skills import SKILL_KEYWORDS, extract_skills  # noqa: F401 (re-exported)
from .fields.work_experience import extract_work_experiences
from .sections import segment_sections
from .spacy_model import preload_nlp_model  # noqa: F401 (re-exported)


def parse_resume_text(text: str) -> dict:
    """Returns a dict of extracted profile fields. Every value is already
    confidence-filtered by its extractor — None/empty means 'no confident value
    found,' never a guess."""
    sections = segment_sections(text)
    skills = extract_skills(sections)

    return {
        "full_name": extract_name(text),
        "email": extract_email(text),
        "contact_number": extract_phone(text),
        "address": extract_address(sections, text),
        "date_of_birth": extract_dob(text),
        "technical_skills": skills["technical_skills"],
        "soft_skills": skills["soft_skills"],
        "languages_spoken": extract_list_section(sections, "languages"),
        "certifications": extract_list_section(sections, "certifications"),
        "work_experiences": extract_work_experiences(sections.get("experience", "")),
        "educations": extract_educations(sections.get("education", "")),
    }
