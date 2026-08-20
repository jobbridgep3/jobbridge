from models.jobseeker import JobseekerProfile
from models.user import User
from services.email_service import send_new_vacancy_email
from services.matching_service import rank_jobseekers_for_vacancy
from services.notification_service import notify_role, notify_user

# Threshold kept low deliberately. matching_service now weighs title, skills,
# certifications, education/course, category and description text together
# (see matching_service.py's module docstring for the weighting table), which
# raised real-match scores well above the old skills-only baseline (~14/100
# empirically) — a genuine strong match now typically scores in the 60-80
# range, and even a partial/skills-only match to an otherwise-unrelated role
# scores in the low 20s. Unrelated or empty-skills profiles still reliably
# score 0. Kept at 5 rather than raised, since a higher threshold (e.g. 20)
# previously silently excluded genuine matches (the reported "no
# notifications are being sent" incident) — the low cost of an occasional
# weak-match notification is preferable to that failure mode recurring.
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
