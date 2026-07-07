"""Shared dashboard summary/analytics query logic.

Used by both Admin and PESO Staff dashboards (backend/blueprints/admin.py and
backend/blueprints/staff.py) — none of this data (jobseeker/employer/vacancy/
application/placement counts and trends) is admin-sensitive; only staff-account
management and the full Audit Trail viewer are genuinely admin-exclusive, and those
stay defined only in admin.py.
"""

from datetime import date

from sqlalchemy import func

from extensions import db
from models.application import APPLICATION_STATUSES, Application
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.nlp_service import SKILL_KEYWORDS
from utils.timezone import now_manila


def _month_buckets(n: int):
    """Returns the last n (year, month) tuples ending at the current month, oldest first."""
    today = now_manila().date()
    y, m = today.year, today.month
    buckets = []
    for _ in range(n):
        buckets.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    buckets.reverse()
    return buckets


def build_summary() -> dict:
    total_jobseekers = JobseekerProfile.query.count()
    active_employers = (
        db.session.query(EmployerCompany)
        .join(User, EmployerCompany.user_id == User.id)
        .filter(EmployerCompany.verification_status == "verified", User.is_active.is_(True))
        .count()
    )
    active_vacancies = Vacancy.query.filter_by(status="active").count()
    total_applications = Application.query.count()
    total_placements = EmploymentRecord.query.count()
    successful_placements = EmploymentRecord.query.filter(
        EmploymentRecord.status.in_(("active", "completed"))
    ).count()
    placements_this_month = EmploymentRecord.query.filter(
        EmploymentRecord.start_date >= now_manila().date().replace(day=1)
    ).count()

    return {
        "total_jobseekers": total_jobseekers,
        "active_employers": active_employers,
        "active_vacancies": active_vacancies,
        "total_applications": total_applications,
        "successful_placements": successful_placements,
        "placements_this_month": placements_this_month,
        # Same formula as lmi.py's success_rate (active+completed / total) — kept in sync
        # by convention rather than importing across blueprints for one derived percentage.
        "placement_success_rate": round(successful_placements / total_placements * 100, 1) if total_placements else 0,
        # Distinct from placement_success_rate: "of everyone registered, what fraction has
        # ever been placed" (program outcome) vs. "of placements made, what fraction held."
        "employment_rate": round(successful_placements / total_jobseekers * 100, 1) if total_jobseekers else 0,
    }


def build_analytics(months: int) -> dict:
    months = min(max(months, 1), 12)
    buckets = _month_buckets(months)
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]
    start_date = date(buckets[0][0], buckets[0][1], 1)

    # Monthly User Registrations — grouped by role so the chart can show two series.
    reg_rows = (
        db.session.query(func.to_char(User.created_at, "YYYY-MM").label("month"), User.role, func.count(User.id))
        .filter(User.created_at >= start_date, User.role.in_(("jobseeker", "employer")))
        .group_by("month", User.role)
        .all()
    )
    reg_map = {}
    for month, role, count in reg_rows:
        reg_map.setdefault(month, {"jobseekers": 0, "employers": 0})
        reg_map[month]["jobseekers" if role == "jobseeker" else "employers"] = count
    monthly_registrations = [
        {"month": lbl, "jobseekers": 0, "employers": 0, **reg_map.get(lbl, {})} for lbl in labels
    ]

    # Monthly Job Applications
    app_rows = dict(
        db.session.query(func.to_char(Application.created_at, "YYYY-MM"), func.count(Application.id))
        .filter(Application.created_at >= start_date)
        .group_by(func.to_char(Application.created_at, "YYYY-MM"))
        .all()
    )
    monthly_applications = [{"month": lbl, "count": app_rows.get(lbl, 0)} for lbl in labels]

    # Employment Trends — new placements started per month
    emp_rows = dict(
        db.session.query(func.to_char(EmploymentRecord.start_date, "YYYY-MM"), func.count(EmploymentRecord.id))
        .filter(EmploymentRecord.start_date >= start_date)
        .group_by(func.to_char(EmploymentRecord.start_date, "YYYY-MM"))
        .all()
    )
    employment_trends = [{"month": lbl, "placements": emp_rows.get(lbl, 0)} for lbl in labels]

    # Hiring Analytics — the Application status funnel. Scaffolded against the model's own
    # status tuple so a stage with zero applications still renders as a 0 bar, not a gap.
    funnel_rows = dict(db.session.query(Application.status, func.count(Application.id)).group_by(Application.status).all())
    hiring_funnel = [{"status": s, "count": funnel_rows.get(s, 0)} for s in APPLICATION_STATUSES]

    # Job Category Distribution — active vacancies by industry (top 8)
    category_rows = (
        db.session.query(Vacancy.industry, func.count(Vacancy.id))
        .filter(Vacancy.status == "active")
        .group_by(Vacancy.industry)
        .order_by(func.count(Vacancy.id).desc())
        .all()
    )
    job_category_distribution = [{"category": ind or "Unspecified", "count": cnt} for ind, cnt in category_rows[:8]]

    # Most Requested Skills — Vacancy.skills_required is free text (tokenized for TF-IDF,
    # not structured), so there's no GROUP BY for this. Reuse the same curated skill
    # taxonomy already used to parse jobseeker resumes, matched against active vacancies
    # only (small N at municipal-PESO scale, unlike LMI's unbounded full-table loops).
    skill_counts = {}
    for v in Vacancy.query.filter_by(status="active").all():
        text = (v.skills_required or "").lower()
        for kw in SKILL_KEYWORDS:
            if kw in text:
                skill_counts[kw] = skill_counts.get(kw, 0) + 1
    top_skills = [
        {"skill": k.title(), "count": c} for k, c in sorted(skill_counts.items(), key=lambda x: -x[1])[:10]
    ]

    return {
        "monthly_registrations": monthly_registrations,
        "monthly_applications": monthly_applications,
        "employment_trends": employment_trends,
        "hiring_funnel": hiring_funnel,
        "job_category_distribution": job_category_distribution,
        "top_skills": top_skills,
    }
