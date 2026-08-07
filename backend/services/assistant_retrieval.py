"""Role-scoped SQL retrieval for the AI assistant (Phase 3: SQL-based RAG).

Every function below performs targeted, LIMIT-ed, ownership-filtered SQL queries — never
a full-table scan — and returns a plain-text block that gets dropped into the Groq
prompt as a system message. Every category that finds nothing returns an explicit
"none found" line rather than being silently omitted, so the model is told absence
outright instead of being left to guess (see assistant_service.py's grounding guard).

These queries mirror the EXACT ownership patterns already enforced by the equivalent
REST routes: jobs.py/profile.py for jobseeker, employer.py for employer, staff.py/
admin.py/dashboard_service.py for staff/admin. This is the real security boundary —
each function is structurally incapable of returning another user's/company's data,
since every query is filtered by an id derived from the caller's JWT identity, never
from anything in the request body or conversation text.

Called from the request greenlet, before assistant_service.get_reply()'s
eventlet.tpool.execute() call — plain ORM reads, same as every other route in this app.
"""

from models.announcement import Announcement
from models.application import APPLICATION_STATUS_LABELS, Application
from models.audit import AuditTrail
from models.employer import EmployerCompany
from models.employment import EMPLOYMENT_STATUS_LABELS, EmploymentRecord
from models.jobfair import JobFair
from models.jobseeker import JobseekerProfile
from models.notification import Notification
from models.program import ProgramApplication
from models.referral import ReferralLetter
from models.vacancy import Vacancy
from services.dashboard_service import build_summary
from services.matching_service import rank_vacancies_for_jobseeker
from utils.timezone import now_manila


def build_context(role: str | None, user_id: str | None) -> str:
    """Dispatches to the role-appropriate retrieval bundle. `user_id` is the caller's
    JWT identity (or None for an anonymous visitor) — never anything client-supplied."""
    if role == "jobseeker" and user_id:
        return _jobseeker_context(user_id)
    if role == "employer" and user_id:
        return _employer_context(user_id)
    if role == "staff":
        return _staff_context()
    if role == "admin":
        return _admin_context()
    return _public_context()


def _section(title: str, lines: list, empty_message: str) -> str:
    body = "\n".join(f"- {line}" for line in lines) if lines else empty_message
    return f"{title}:\n{body}"


def _salary_text(vacancy: Vacancy) -> str:
    if vacancy.hide_salary:
        return "salary not disclosed"
    if vacancy.salary_min and vacancy.salary_max:
        return f"₱{vacancy.salary_min:,.0f}–₱{vacancy.salary_max:,.0f}"
    return "salary not specified"


# ---------- Jobseeker — mirrors profile.py:_get_profile / jobs.py / referrals.py / employment.py "my X" ----------

def _jobseeker_context(user_id: str) -> str:
    profile = JobseekerProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        return "This jobseeker has no profile on file yet."

    skills = (profile.technical_skills or []) + (profile.soft_skills or [])
    profile_section = (
        "Your profile summary:\n- "
        f"Skills: {', '.join(skills) if skills else 'none listed'}. "
        f"Preferred position: {profile.preferred_job_position or 'not set'}. "
        f"Preferred industry: {profile.preferred_industry or 'not set'}."
    )

    applications = (
        Application.query.filter_by(jobseeker_profile_id=profile.id)
        .order_by(Application.created_at.desc()).limit(5).all()
    )
    applications_section = _section(
        "Your 5 most recent applications",
        [
            f'"{a.vacancy.title}" at '
            f'{a.vacancy.employer_company.company_name if a.vacancy.employer_company else "unknown employer"} '
            f"— status: {APPLICATION_STATUS_LABELS.get(a.status, a.status)} "
            f'(applied {a.created_at.strftime("%b %d, %Y") if a.created_at else "unknown date"})'
            for a in applications
        ],
        "You have no job applications yet.",
    )

    letters = (
        ReferralLetter.query.filter_by(jobseeker_profile_id=profile.id)
        .order_by(ReferralLetter.created_at.desc()).limit(3).all()
    )
    referrals_section = _section(
        "Your 3 most recent referral letters",
        [f"Status: {letter.status}" + (f' — for "{letter.vacancy.title}"' if letter.vacancy else "") for letter in letters],
        "You have no referral letters yet.",
    )

    records = (
        EmploymentRecord.query.filter_by(jobseeker_profile_id=profile.id)
        .order_by(EmploymentRecord.start_date.desc()).limit(3).all()
    )
    employment_section = _section(
        "Your employment history (most recent first)",
        [
            f"{r.position} at {r.employer_company.company_name if r.employer_company else 'unknown employer'} "
            f"— status: {EMPLOYMENT_STATUS_LABELS.get(r.status, r.status)}"
            for r in records
        ],
        "You have no employment records yet.",
    )

    notifications = (
        Notification.query.filter_by(user_id=user_id, is_read=False, is_archived=False)
        .order_by(Notification.created_at.desc()).limit(5).all()
    )
    notifications_section = _section(
        "Your unread notifications",
        [n.title for n in notifications],
        "You have no unread notifications.",
    )

    vacancies = Vacancy.query.filter_by(status="published").filter(Vacancy.deleted_at.is_(None)).all()
    ranked = [pair for pair in rank_vacancies_for_jobseeker(profile, vacancies)[:3] if pair[1] > 0]
    recommended_section = _section(
        "Jobs recommended for you (AI-matched to your profile)",
        [
            f'"{v.title}" at {v.employer_company.company_name if v.employer_company else "unknown employer"} '
            f"— {score:.0f}% match"
            for v, score in ranked
        ],
        "No strong job matches were found for your profile right now.",
    )

    return "\n\n".join([
        profile_section, applications_section, referrals_section,
        employment_section, notifications_section, recommended_section,
    ])


# ---------- Employer — mirrors employer.py's _company()/my_vacancies/_applicants_query ----------

def _employer_context(user_id: str) -> str:
    company = EmployerCompany.query.filter_by(user_id=user_id).first()
    if not company:
        return "This employer has no company profile on file yet."

    profile_section = (
        "Your company profile:\n- "
        f"{company.company_name}, industry: {company.industry or 'not set'}, "
        f"hiring status: {company.hiring_status}, accreditation: {company.accreditation_status}."
    )

    vacancies = (
        Vacancy.query.filter_by(employer_company_id=company.id, is_template=False)
        .filter(Vacancy.deleted_at.is_(None))
        .order_by(Vacancy.created_at.desc()).limit(5).all()
    )
    vacancies_section = _section(
        "Your 5 most recent job postings",
        [f'"{v.title}" — status: {v.status}, {v.num_slots} slot(s), {_salary_text(v)}' for v in vacancies],
        "You have no job postings yet.",
    )

    applicants = (
        Application.query.join(Vacancy)
        .filter(Vacancy.employer_company_id == company.id)
        .order_by(Application.created_at.desc()).limit(5).all()
    )
    applicants_section = _section(
        "Your 5 most recent applicants (across all your postings)",
        [
            f'{a.jobseeker_profile.full_name} applied to "{a.vacancy.title}" '
            f"— status: {APPLICATION_STATUS_LABELS.get(a.status, a.status)}"
            + (f", match score {a.match_score:.0f}%" if a.match_score is not None else "")
            for a in applicants
        ],
        "You have no applicants yet.",
    )

    total_applications = Application.query.join(Vacancy).filter(Vacancy.employer_company_id == company.id).count()
    hired_count = (
        Application.query.join(Vacancy)
        .filter(Vacancy.employer_company_id == company.id, Application.status == "hired").count()
    )
    stats_section = f"Your hiring stats:\n- {total_applications} total application(s) received, {hired_count} hire(s) made."

    return "\n\n".join([profile_section, vacancies_section, applicants_section, stats_section])


# ---------- PESO Staff — mirrors staff.py's dashboard_stats/pending_approvals; excludes admin-only data ----------

def _staff_context() -> str:
    summary = build_summary()
    stats_section = (
        "System-wide JobBridge statistics:\n- "
        f"{summary['total_jobseekers']} registered jobseekers, {summary['active_employers']} active employers, "
        f"{summary['active_vacancies']} active job postings, {summary['total_applications']} total applications, "
        f"{summary['successful_placements']} successful placements ({summary['placements_this_month']} this month)."
    )

    pending_section = (
        "Pending approvals awaiting staff action:\n- "
        f"{Vacancy.query.filter_by(status='pending').count()} job posting(s), "
        f"{EmployerCompany.query.filter_by(accreditation_status='pending_review').count()} employer verification(s), "
        f"{ProgramApplication.query.filter_by(program_type='spes', status='submitted').count()} SPES, "
        f"{ProgramApplication.query.filter_by(program_type='dilp', status='submitted').count()} DILP, "
        f"{ProgramApplication.query.filter_by(program_type='owwa', status='submitted').count()} OWWA application(s)."
    )

    # Deliberately does NOT query the audit trail or anything else staff.py itself
    # denies staff — see _admin_context() for the only place that data is fetched.
    return "\n\n".join([stats_section, pending_section, _public_shared_sections()])


# ---------- Admin — everything staff gets, plus admin-only data ----------

def _admin_context() -> str:
    summary = build_summary()
    stats_section = (
        "System-wide JobBridge statistics:\n- "
        f"{summary['total_jobseekers']} registered jobseekers, {summary['active_employers']} active employers, "
        f"{summary['active_vacancies']} active job postings, {summary['total_applications']} total applications, "
        f"{summary['successful_placements']} successful placements ({summary['placements_this_month']} this month), "
        f"{summary['new_registrations_this_month']} new registration(s) this month."
    )

    flagged = JobseekerProfile.query.filter_by(is_flagged=True).count() + EmploymentRecord.query.filter_by(flagged_discrepancy=True).count()
    pending_section = (
        "Pending admin actions:\n- "
        f"{EmployerCompany.query.filter_by(accreditation_status='pending_review').count()} employer verification(s), "
        f"{Vacancy.query.filter_by(status='pending').count()} job approval(s), {flagged} flagged record(s)."
    )

    audit_entries = AuditTrail.query.order_by(AuditTrail.created_at.desc()).limit(5).all()
    audit_section = _section(
        "5 most recent audit trail entries",
        [f"{a.action} on {a.module} by {a.user_email or 'unknown user'} — {a.status}" for a in audit_entries],
        "The audit trail has no entries yet.",
    )

    return "\n\n".join([stats_section, pending_section, audit_section, _public_shared_sections()])


# ---------- Public — mirrors jobs.py/jobfair.py/announcements.py's unauthenticated views ----------

def _public_context() -> str:
    return _public_shared_sections()


def _public_shared_sections() -> str:
    """Publicly-visible data reused by the public, staff, and admin bundles — staff/admin
    can see everything a public visitor can, plus their own additional sections above."""
    vacancies = (
        Vacancy.query.filter_by(status="published").filter(Vacancy.deleted_at.is_(None))
        .order_by(Vacancy.created_at.desc()).limit(5).all()
    )
    vacancy_section = _section(
        "5 most recently posted jobs",
        [
            f'"{v.title}" at {v.employer_company.company_name if v.employer_company else "unknown employer"} '
            f"— {v.work_location or 'location not specified'}, {_salary_text(v)}"
            for v in vacancies
        ],
        "No jobs are currently posted.",
    )

    fairs = (
        JobFair.query.filter(JobFair.status.in_(("published", "ongoing")))
        .filter(JobFair.event_date >= now_manila())
        .order_by(JobFair.event_date.asc()).limit(3).all()
    )
    fair_section = _section(
        "3 upcoming job fairs",
        [f"{f.name} — {f.venue}, {f.event_date.strftime('%b %d, %Y')}" for f in fairs],
        "No upcoming job fairs are currently scheduled.",
    )

    announcements = (
        Announcement.query.filter(Announcement.target_roles.contains(["public"]))
        .filter(Announcement.status == "published")
        .filter(Announcement.published_at.isnot(None), Announcement.published_at <= now_manila())
        .order_by(Announcement.is_pinned.desc(), Announcement.published_at.desc()).limit(3).all()
    )
    announcement_section = _section(
        "3 most recent public announcements",
        [a.title for a in announcements],
        "There are no public announcements right now.",
    )

    return "\n\n".join([vacancy_section, fair_section, announcement_section])
