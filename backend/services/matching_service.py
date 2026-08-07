"""AI job matching: TF-IDF Vectorizer + Cosine Similarity (scikit-learn).

Fully real — no external credentials required. Runs on profile save and job search.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _profile_text(jobseeker_profile) -> str:
    skills = " ".join(
        (jobseeker_profile.technical_skills or [])
        + (jobseeker_profile.soft_skills or [])
        + (jobseeker_profile.languages_spoken or [])
        + (jobseeker_profile.certifications or [])
    )
    experience = " ".join(f"{w.position} {w.company}" for w in jobseeker_profile.work_experiences)
    education = " ".join(f"{e.degree or ''} {e.school}" for e in jobseeker_profile.educations)
    return f"{skills} {experience} {education}".strip()


def _vacancy_text(vacancy) -> str:
    return f"{vacancy.title} {vacancy.skills_required or ''} {vacancy.requirements or ''} {vacancy.industry or ''}".strip()


def _score_texts(text_a: str, text_b: str) -> float:
    """Core TF-IDF + cosine similarity computation, shared by every match_score* function
    below — extracted so a not-yet-saved raw text (e.g. an uploaded-but-unsaved resume,
    see match_score_from_text) can reuse the exact same scoring logic as a real profile."""
    if not text_a or not text_b:
        return 0.0
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
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
