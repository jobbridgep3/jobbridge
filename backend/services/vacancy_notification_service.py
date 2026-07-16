from models.jobseeker import JobseekerProfile
from models.user import User
from services.email_service import send_new_vacancy_email
from services.matching_service import rank_jobseekers_for_vacancy
from services.notification_service import notify_role, notify_user

# Threshold kept low deliberately: this is TF-IDF cosine similarity over just
# two short documents (one profile, one vacancy), which produces much lower
# absolute scores than intuition suggests even for a strong match — confirmed
# empirically, a jobseeker whose skills were an exact 1:1 match for
# required_skills scored only ~14/100, while unrelated or empty-skills
# profiles reliably score 0. A higher threshold (e.g. 20) silently excluded
# genuine matches — exactly the reported "no notifications are being sent"
# symptom.
MATCH_THRESHOLD = 5


def notify_jobseekers_of_new_vacancy(vacancy, company):
    """Notifies (persisted in-app notification + email) jobseekers whose
    profile reasonably matches this vacancy, using the same matching engine
    that powers the employer's "AI-Suggested Matched Jobseekers" panel, then
    broadcasts an unpersisted ping so anyone currently browsing the Jobs list
    sees the new posting live regardless of whether they matched.

    Shared by every code path that makes a vacancy newly visible to
    jobseekers: employer self-publish, staff walk-in entry, and staff
    reactivation.
    """
    candidates = JobseekerProfile.query.filter_by(is_verified_by_staff=True).limit(500).all()
    matched = [(p, score) for p, score in rank_jobseekers_for_vacancy(vacancy, candidates) if score >= MATCH_THRESHOLD]
    for profile, _score in matched:
        notify_user(
            profile.user_id, "vacancy_published", "New Job Opportunity!",
            f"{vacancy.title} at {company.company_name} has just been posted. Click to view and apply.",
            link=f"/jobseeker/jobs/{vacancy.id}", socket_event="vacancy:published",
            socket_payload={"vacancy_id": str(vacancy.id), "title": vacancy.title, "company_name": company.company_name},
        )
        send_new_vacancy_email(User.query.get(profile.user_id).email, profile.full_name, vacancy, company)
    notify_role("jobseeker", "vacancy:new", {"vacancy_id": str(vacancy.id), "title": vacancy.title})
