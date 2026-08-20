"""AI job matching: TF-IDF Vectorizer + Cosine Similarity (scikit-learn).

Fully real — no external credentials required. Runs on profile save and job search.

Text-composition weighting (repeat-count = weight, applied symmetrically so
neither side's document is arbitrarily inflated relative to the other):

    Concept          Jobseeker field(s)                          Weight  Vacancy field(s)                              Weight
    Skills           technical_skills                              x3    skills_required + required_skills             x3
    Soft/languages    soft_skills, languages_spoken                 x1    -                                              -
    Certifications    certifications                                x2    required_certifications                       x2
    Title             preferred_job_position + WorkExperience.position x2  title                                        x3
    Degree/Course     Education.degree                              x2    course                                        x2
    Education level   Education.attainment_level                    x1    education_level                               x1
    Category          -                                              -    category.name                                 x2
    Free-text context preferred_industry, WorkExperience.company/  x1    requirements, responsibilities, daily_tasks,  x1
                       .description, Education.school                     summary (HTML-stripped), industry, department
"""

import html
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Preserves compound technical terms the default sklearn token_pattern destroys
# (C++, C#, node.js, .NET) — starts on an alphanumeric char, then allows word
# chars plus + # . - to continue the same token.
TOKEN_PATTERN = r"(?u)[a-zA-Z0-9][\w\+\#\.\-]*"

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_SENTENCE_DOT_RE = re.compile(r"\.(?=\s|$)")  # drop sentence-ending periods without touching in-word dots like "node.js"


def _clean_text(value) -> str:
    if not value:
        return ""
    text = _HTML_TAG_RE.sub(" ", str(value))
    text = html.unescape(text)
    text = _SENTENCE_DOT_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def _dedupe(items) -> list:
    """Removes exact duplicate entries (case-insensitive) so accidental double
    data-entry doesn't silently compound on top of the intentional field
    repetition below."""
    seen, out = set(), []
    for item in items or []:
        key = (item or "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out


def _repeat(text, times: int) -> str:
    text = _clean_text(text)
    return " ".join([text] * times) if text else ""


def _profile_text(jobseeker_profile) -> str:
    technical = _repeat(" ".join(_dedupe(jobseeker_profile.technical_skills)), 3)
    soft = _repeat(" ".join(_dedupe(jobseeker_profile.soft_skills)), 1)
    languages = _repeat(" ".join(_dedupe(jobseeker_profile.languages_spoken)), 1)
    certifications = _repeat(" ".join(_dedupe(jobseeker_profile.certifications)), 2)
    desired_title = _repeat(jobseeker_profile.preferred_job_position, 2)
    preferred_industry = _clean_text(jobseeker_profile.preferred_industry)

    experience_parts = []
    for w in jobseeker_profile.work_experiences:
        experience_parts.append(_repeat(w.position, 2))
        experience_parts.append(_clean_text(w.company))
        experience_parts.append(_clean_text(w.description))

    education_parts = []
    for e in jobseeker_profile.educations:
        education_parts.append(_repeat(e.degree, 2))
        education_parts.append(_clean_text(e.attainment_level))
        education_parts.append(_clean_text(e.school))

    return " ".join(filter(None, [
        technical, soft, languages, certifications, desired_title, preferred_industry,
        *experience_parts, *education_parts,
    ])).strip()


def _vacancy_text(vacancy) -> str:
    title = _repeat(vacancy.title, 3)
    category = _repeat(vacancy.category.name if vacancy.category else "", 2)
    skills_block = " ".join(filter(None, [
        _clean_text(vacancy.skills_required),
        " ".join(_dedupe(vacancy.required_skills)),
    ]))
    skills = _repeat(skills_block, 3)
    certifications = _repeat(" ".join(_dedupe(vacancy.required_certifications)), 2)
    course = _repeat(vacancy.course, 2)
    education_level = _clean_text(vacancy.education_level)
    requirements = _clean_text(vacancy.requirements)
    responsibilities = _clean_text(vacancy.responsibilities)
    daily_tasks = _clean_text(vacancy.daily_tasks)
    summary = _clean_text(vacancy.summary)
    industry = _clean_text(vacancy.industry)
    department = _clean_text(vacancy.department)

    return " ".join(filter(None, [
        title, category, skills, certifications, course, education_level,
        requirements, responsibilities, daily_tasks, summary, industry, department,
    ])).strip()


def _score_texts(text_a: str, text_b: str) -> float:
    """Core TF-IDF + cosine similarity computation, shared by every match_score* function
    below — extracted so a not-yet-saved raw text (e.g. an uploaded-but-unsaved resume,
    see match_score_from_text) can reuse the exact same scoring logic as a real profile."""
    if not text_a or not text_b:
        return 0.0
    try:
        vectorizer = TfidfVectorizer(stop_words="english", token_pattern=TOKEN_PATTERN)
        tfidf = vectorizer.fit_transform([text_a, text_b])
        score = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        return round(float(score) * 100, 1)
    except ValueError:
        return 0.0


def match_score(jobseeker_profile, vacancy) -> float:
    """Returns a 0-100 match percentage between one jobseeker and one vacancy."""
    return _score_texts(_profile_text(jobseeker_profile), _vacancy_text(vacancy))


def match_score_from_text(resume_text: str, vacancy) -> float:
    """Same scoring as match_score(), for a raw (not-yet-saved) uploaded resume's text —
    used by the AI assistant's document-upload comparison feature."""
    return _score_texts(resume_text, _vacancy_text(vacancy))


def rank_vacancies_for_jobseeker(jobseeker_profile, vacancies: list) -> list[tuple]:
    """Returns [(vacancy, score), ...] sorted by score desc."""
    scored = [(v, match_score(jobseeker_profile, v)) for v in vacancies]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)


def rank_vacancies_for_text(resume_text: str, vacancies: list) -> list[tuple]:
    """Returns [(vacancy, score), ...] sorted by score desc, for an uploaded resume's raw text."""
    scored = [(v, match_score_from_text(resume_text, v)) for v in vacancies]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)


def rank_jobseekers_for_vacancy(vacancy, profiles: list) -> list[tuple]:
    """Returns [(profile, score), ...] sorted by score desc — used by employer's 'AI-suggested matches'."""
    scored = [(p, match_score(p, vacancy)) for p in profiles]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)
