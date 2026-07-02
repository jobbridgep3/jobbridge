"""AI job matching: TF-IDF Vectorizer + Cosine Similarity (scikit-learn).

Fully real — no external credentials required. Runs on profile save and job search.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _profile_text(jobseeker_profile) -> str:
    skills = " ".join(jobseeker_profile.skills or [])
    experience = " ".join(f"{w.position} {w.company}" for w in jobseeker_profile.work_experiences)
    education = " ".join(f"{e.degree} {e.school}" for e in jobseeker_profile.educations)
    return f"{skills} {experience} {education}".strip()


def _vacancy_text(vacancy) -> str:
    return f"{vacancy.title} {vacancy.skills_required or ''} {vacancy.requirements or ''} {vacancy.industry or ''}".strip()


def match_score(jobseeker_profile, vacancy) -> float:
    """Returns a 0-100 match percentage between one jobseeker and one vacancy."""
    profile_text = _profile_text(jobseeker_profile)
    vacancy_text = _vacancy_text(vacancy)
    if not profile_text or not vacancy_text:
        return 0.0
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf = vectorizer.fit_transform([profile_text, vacancy_text])
        score = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
        return round(float(score) * 100, 1)
    except ValueError:
        return 0.0


def rank_vacancies_for_jobseeker(jobseeker_profile, vacancies: list) -> list[tuple]:
    """Returns [(vacancy, score), ...] sorted by score desc."""
    scored = [(v, match_score(jobseeker_profile, v)) for v in vacancies]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)


def rank_jobseekers_for_vacancy(vacancy, profiles: list) -> list[tuple]:
    """Returns [(profile, score), ...] sorted by score desc — used by employer's 'AI-suggested matches'."""
    scored = [(p, match_score(p, vacancy)) for p in profiles]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)
