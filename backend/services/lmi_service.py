"""LMI (Labor Market Information) Reports & Analytics — single source of truth
for every KPI/chart/table/export in the LMI module. Every aggregation function
here is called identically by the dashboard JSON routes (backend/blueprints/lmi.py)
and by the Excel/PDF export builders, so a filtered view on screen and its
exported report can never disagree on a number.

Design notes (documented once here rather than repeated at each call site):

- Authoritative "Hired/Placed" source is EmploymentRecord existence (not
  Application.status=='hired'), since staff-entered walk-in hires
  (EmploymentRecord.is_walk_in=True) have no Application row at all — counting
  from Application alone would undercount. Application.status=='hired' is used
  only as one stage label inside the employment funnel, never summed elsewhere.
- Active Employers reuses services/dashboard_service.py::build_summary()'s
  exact formula (EmployerCompany.accreditation_status=='accredited' AND
  User.is_active) so the two modules never disagree on this number.
- Active Jobseekers = JobseekerProfile joined to User where User.is_active —
  the jobseeker-side parallel to Active Employers, using the same real,
  staff-controllable flag (no prior definition existed to reuse).
- Employment Rate (KPI) = EmploymentRecord-based successful placements /
  total jobseekers — NOT the self-reported JobseekerProfile.employment_status
  field, which is a separate demographic dimension shown in the Jobseeker
  Labor Profile section, not the headline KPI. Both are documented here so the
  difference isn't mistaken for an inconsistency.
- Skills are unstructured free-text JSON arrays with no controlled vocabulary
  anywhere in this schema (no Skill table exists). Skills Gap/Demand analytics
  normalize via `.strip().lower()` only — near-duplicates like "MS Excel" vs
  "Excel" are NOT merged. This is a known, documented data-quality limitation.
- Skill Gap = vacancy_demand_count - jobseeker_supply_count (positive =
  shortage/high demand, negative = surplus). This exact function backs the
  dashboard, the Excel "Skills Gap" sheet, and the PDF Skills Analysis section.
- Hard-to-Fill = published >=30 days ago with fewer applications than
  num_slots. Deliberately simpler than vacancy_capacity_service.py's real-time
  per-vacancy occupied-slots definition (which is correct for a single vacancy
  page but would be N+1 at report scale) — documented as a distinct, batched
  approximation for aggregate reporting, not a replacement for that service.
- Time-to-Placement only covers EmploymentRecords with a non-null
  application_id (excludes walk-ins) — always reported alongside its N so it's
  never mistaken for a platform-wide average.
- JobseekerProfile.barangay is free text; Vacancy/EmployerCompany use
  structured PSGC barangay_name. Cross-referencing them is exact-string
  matching only — a known data-quality caveat inherent to the schema.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import and_, func, or_

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.employment import EMPLOYMENT_END_STATUSES, EmploymentRecord
from models.interview import Interview
from models.jobseeker import Education, JobseekerProfile
from models.referral import ReferralLetter
from models.user import User
from models.vacancy import VACANCY_STATUSES, Vacancy, VacancyCategory
from services.excel_service import build_multi_sheet_excel_report
from services.notification_service import notify_role
from utils.timezone import manila_day_bounds, now_manila

PERIOD_CHOICES = ("today", "week", "month", "quarter", "year", "custom", "all")
HARD_TO_FILL_DAYS = 30

# Fields whose change should trigger a live LMI refresh (see notify_lmi_update
# call sites in blueprints/profile.py and blueprints/staff.py) — everything
# else a jobseeker can edit (contact number, profile picture, etc.) doesn't
# feed any LMI analytic, so gating on this set avoids a refetch storm on
# every unrelated profile edit.
LMI_RELEVANT_PROFILE_FIELDS = (
    "barangay", "municipality", "employment_status", "preferred_job_position",
    "preferred_industry", "technical_skills", "soft_skills", "educations",
)


@dataclass
class LmiFilters:
    date_from: str | None = None
    date_to: str | None = None
    dt_start: object = None  # tz-aware Manila datetime (inclusive) or None
    dt_end: object = None  # tz-aware Manila datetime (exclusive) or None
    barangay: str | None = None
    municipality: str | None = None
    employment_status: str | None = None
    gender: str | None = None
    age_min: int | None = None
    age_max: int | None = None
    educational_attainment: str | None = None
    industry: str | None = None
    occupation: str | None = None
    job_category_id: str | None = None
    employer_company_id: str | None = None
    vacancy_status: str | None = None
    period: str = "all"


def parse_lmi_filters(args) -> LmiFilters:
    """Shared filter parser — every LMI route and both export builders call this,
    so the dashboard and its exports can never apply different filter logic."""
    period = args.get("period") or "all"
    if period not in PERIOD_CHOICES:
        period = "all"
    date_from = args.get("date_from") or None
    date_to = args.get("date_to") or None

    if period not in ("custom", "all"):
        today = now_manila().date()
        if period == "today":
            date_from = date_to = today.isoformat()
        elif period == "week":
            date_from = (today - timedelta(days=today.weekday())).isoformat()
            date_to = today.isoformat()
        elif period == "month":
            date_from = today.replace(day=1).isoformat()
            date_to = today.isoformat()
        elif period == "quarter":
            q_start_month = ((today.month - 1) // 3) * 3 + 1
            date_from = today.replace(month=q_start_month, day=1).isoformat()
            date_to = today.isoformat()
        elif period == "year":
            date_from = today.replace(month=1, day=1).isoformat()
            date_to = today.isoformat()

    dt_start, dt_end = manila_day_bounds(date_from, date_to) if (date_from or date_to) else (None, None)

    def _int(key):
        v = args.get(key)
        try:
            return int(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            return None

    return LmiFilters(
        date_from=date_from, date_to=date_to, dt_start=dt_start, dt_end=dt_end,
        barangay=args.get("barangay") or None,
        municipality=args.get("municipality") or None,
        employment_status=args.get("employment_status") or None,
        gender=args.get("gender") or None,
        age_min=_int("age_min"), age_max=_int("age_max"),
        educational_attainment=args.get("educational_attainment") or None,
        industry=args.get("industry") or None,
        occupation=args.get("occupation") or None,
        job_category_id=args.get("job_category_id") or None,
        employer_company_id=args.get("employer_company_id") or None,
        vacancy_status=args.get("vacancy_status") or None,
        period=period,
    )


def filters_display(filters: LmiFilters) -> list[tuple[str, str]]:
    """Human-readable (label, value) pairs for "Applied Filters" — shown identically
    at the top of both the Excel Executive Summary sheet and the PDF cover section."""
    period_label = {
        "today": "Today", "week": "This Week", "month": "This Month", "quarter": "This Quarter",
        "year": "This Year", "custom": "Custom Range", "all": "All Time",
    }.get(filters.period, "All Time")
    date_range = (
        f"{filters.date_from} to {filters.date_to}" if filters.date_from or filters.date_to else "All Time"
    )
    rows = [("Reporting Period", period_label), ("Date Range", date_range)]
    optional = [
        ("Barangay", filters.barangay), ("Municipality", filters.municipality),
        ("Employment Status", filters.employment_status), ("Gender", filters.gender),
        ("Educational Attainment", filters.educational_attainment), ("Industry", filters.industry),
        ("Occupation", filters.occupation), ("Vacancy Status", filters.vacancy_status),
    ]
    if filters.age_min is not None or filters.age_max is not None:
        optional.append(("Age Group", f"{filters.age_min or 0}–{filters.age_max or '∞'}"))
    if filters.job_category_id:
        category = VacancyCategory.query.get(filters.job_category_id)
        optional.append(("Job Category", category.name if category else filters.job_category_id))
    if filters.employer_company_id:
        company = EmployerCompany.query.get(filters.employer_company_id)
        optional.append(("Employer", company.company_name if company else filters.employer_company_id))
    for label, value in optional:
        rows.append((label, value or "All"))
    return rows


def _dob_bounds_for_age(age_min, age_max):
    """Converts an [age_min, age_max] range into [min_dob, max_dob] date_of_birth
    bounds (inclusive), safely handling Feb 29 birthdates in non-leap shift years."""
    if age_min is None and age_max is None:
        return None, None
    today = now_manila().date()

    def _shift_years(d, years):
        try:
            return d.replace(year=d.year - years)
        except ValueError:
            return d.replace(month=2, day=28, year=d.year - years)

    max_dob = _shift_years(today, age_min) if age_min is not None else None
    min_dob = (_shift_years(today, age_max + 1) + timedelta(days=1)) if age_max is not None else None
    return min_dob, max_dob


# ---------- Base filtered queries ----------

def _jobseeker_query(filters: LmiFilters):
    q = JobseekerProfile.query
    if filters.dt_start is not None:
        q = q.filter(JobseekerProfile.created_at >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(JobseekerProfile.created_at < filters.dt_end)
    if filters.barangay:
        q = q.filter(JobseekerProfile.barangay == filters.barangay)
    if filters.municipality:
        q = q.filter(JobseekerProfile.municipality == filters.municipality)
    if filters.employment_status:
        q = q.filter(JobseekerProfile.employment_status == filters.employment_status)
    if filters.gender:
        q = q.filter(JobseekerProfile.gender == filters.gender)
    if filters.industry:
        q = q.filter(JobseekerProfile.preferred_industry == filters.industry)
    if filters.occupation:
        q = q.filter(JobseekerProfile.preferred_job_position.ilike(f"%{filters.occupation}%"))
    if filters.educational_attainment:
        q = q.join(Education, Education.profile_id == JobseekerProfile.id).filter(
            Education.attainment_level == filters.educational_attainment
        )
    min_dob, max_dob = _dob_bounds_for_age(filters.age_min, filters.age_max)
    if max_dob is not None:
        q = q.filter(JobseekerProfile.date_of_birth <= max_dob)
    if min_dob is not None:
        q = q.filter(JobseekerProfile.date_of_birth >= min_dob)
    return q


def _vacancy_query(filters: LmiFilters):
    q = Vacancy.query.filter(Vacancy.deleted_at.is_(None))
    if filters.dt_start is not None:
        q = q.filter(Vacancy.created_at >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(Vacancy.created_at < filters.dt_end)
    if filters.municipality:
        q = q.filter(Vacancy.city_municipality_name == filters.municipality)
    if filters.barangay:
        q = q.filter(Vacancy.barangay_name == filters.barangay)
    if filters.industry:
        q = q.filter(Vacancy.industry == filters.industry)
    if filters.occupation:
        q = q.filter(Vacancy.title.ilike(f"%{filters.occupation}%"))
    if filters.job_category_id:
        q = q.filter(Vacancy.category_id == filters.job_category_id)
    if filters.employer_company_id:
        q = q.filter(Vacancy.employer_company_id == filters.employer_company_id)
    if filters.vacancy_status:
        q = q.filter(Vacancy.status == filters.vacancy_status)
    return q


def _application_query(filters: LmiFilters):
    q = Application.query
    if filters.dt_start is not None:
        q = q.filter(Application.created_at >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(Application.created_at < filters.dt_end)
    if filters.industry or filters.employer_company_id or filters.vacancy_status or filters.job_category_id or filters.occupation:
        q = q.join(Vacancy, Application.vacancy_id == Vacancy.id)
        if filters.industry:
            q = q.filter(Vacancy.industry == filters.industry)
        if filters.employer_company_id:
            q = q.filter(Vacancy.employer_company_id == filters.employer_company_id)
        if filters.vacancy_status:
            q = q.filter(Vacancy.status == filters.vacancy_status)
        if filters.job_category_id:
            q = q.filter(Vacancy.category_id == filters.job_category_id)
        if filters.occupation:
            q = q.filter(Vacancy.title.ilike(f"%{filters.occupation}%"))
    if filters.barangay or filters.municipality or filters.gender or filters.employment_status:
        q = q.join(JobseekerProfile, Application.jobseeker_profile_id == JobseekerProfile.id)
        if filters.barangay:
            q = q.filter(JobseekerProfile.barangay == filters.barangay)
        if filters.municipality:
            q = q.filter(JobseekerProfile.municipality == filters.municipality)
        if filters.gender:
            q = q.filter(JobseekerProfile.gender == filters.gender)
        if filters.employment_status:
            q = q.filter(JobseekerProfile.employment_status == filters.employment_status)
    return q


def _employment_query(filters: LmiFilters):
    q = EmploymentRecord.query
    if filters.dt_start is not None:
        q = q.filter(EmploymentRecord.start_date >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(EmploymentRecord.start_date < filters.dt_end)
    if filters.employer_company_id:
        q = q.filter(EmploymentRecord.employer_company_id == filters.employer_company_id)
    if filters.barangay or filters.municipality or filters.gender:
        q = q.join(JobseekerProfile, EmploymentRecord.jobseeker_profile_id == JobseekerProfile.id)
        if filters.barangay:
            q = q.filter(JobseekerProfile.barangay == filters.barangay)
        if filters.municipality:
            q = q.filter(JobseekerProfile.municipality == filters.municipality)
        if filters.gender:
            q = q.filter(JobseekerProfile.gender == filters.gender)
    if filters.industry:
        q = q.join(EmployerCompany, EmploymentRecord.employer_company_id == EmployerCompany.id).filter(
            EmployerCompany.industry == filters.industry
        )
    return q


def _referral_query(filters: LmiFilters, status="approved"):
    q = ReferralLetter.query.filter(ReferralLetter.status == status) if status else ReferralLetter.query
    if filters.dt_start is not None:
        q = q.filter(ReferralLetter.created_at >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(ReferralLetter.created_at < filters.dt_end)
    if filters.barangay or filters.municipality or filters.gender:
        q = q.join(JobseekerProfile, ReferralLetter.jobseeker_profile_id == JobseekerProfile.id)
        if filters.barangay:
            q = q.filter(JobseekerProfile.barangay == filters.barangay)
        if filters.municipality:
            q = q.filter(JobseekerProfile.municipality == filters.municipality)
        if filters.gender:
            q = q.filter(JobseekerProfile.gender == filters.gender)
    return q


def _interview_query(filters: LmiFilters):
    q = Interview.query
    if filters.dt_start is not None:
        q = q.filter(Interview.scheduled_date >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(Interview.scheduled_date < filters.dt_end)
    return q


def _employer_query(filters: LmiFilters):
    q = EmployerCompany.query
    if filters.dt_start is not None:
        q = q.filter(EmployerCompany.created_at >= filters.dt_start)
    if filters.dt_end is not None:
        q = q.filter(EmployerCompany.created_at < filters.dt_end)
    if filters.municipality:
        q = q.filter(EmployerCompany.city_municipality_name == filters.municipality)
    if filters.industry:
        q = q.filter(EmployerCompany.industry == filters.industry)
    return q


# ---------- KPI Summary ----------

def build_kpi_summary(filters: LmiFilters) -> dict:
    total_jobseekers = _jobseeker_query(filters).count()
    active_jobseekers = (
        _jobseeker_query(filters)
        .join(User, JobseekerProfile.user_id == User.id)
        .filter(User.is_active.is_(True))
        .count()
    )
    total_employers = _employer_query(filters).count()
    active_employers = (
        _employer_query(filters)
        .join(User, EmployerCompany.user_id == User.id)
        .filter(EmployerCompany.accreditation_status == "accredited", User.is_active.is_(True))
        .count()
    )
    total_vacancies = _vacancy_query(filters).count()
    total_applicants = _application_query(filters).with_entities(Application.jobseeker_profile_id).distinct().count()
    total_referrals = _referral_query(filters).count()
    total_interviews = _interview_query(filters).count()
    total_hired = _employment_query(filters).count()
    # Placement Rate is "of everyone who applied, what share was placed" — its
    # denominator (total_applicants) is application-based, so the numerator must
    # be too, or a hiring pool with many staff-entered walk-ins (EmploymentRecord
    # rows with no linked Application at all) can push this rate past 100%.
    # "Total Hired / Placed" above intentionally stays the full count (including
    # walk-ins) since that KPI is a headline total, not a rate.
    # Distinct jobseekers, not row count — one jobseeker can have multiple
    # EmploymentRecord rows (re-hires, multiple applications), which would
    # otherwise let this exceed total_applicants (itself a distinct-jobseeker count).
    linked_hired = (
        _employment_query(filters)
        .filter(EmploymentRecord.application_id.isnot(None))
        .with_entities(EmploymentRecord.jobseeker_profile_id).distinct().count()
    )
    # Distinct jobseekers here too (see linked_hired above) — this is the
    # numerator for employment_rate against total_jobseekers.
    successful_placements = (
        _employment_query(filters)
        .filter(EmploymentRecord.status.in_(("active", "completed")))
        .with_entities(EmploymentRecord.jobseeker_profile_id).distinct().count()
    )
    unfilled_vacancies = _vacancy_query(filters).filter(Vacancy.status == "published").count()

    return {
        "total_jobseekers": total_jobseekers,
        "active_jobseekers": active_jobseekers,
        "total_employers": total_employers,
        "active_employers": active_employers,
        "total_vacancies": total_vacancies,
        "total_applicants": total_applicants,
        "total_referrals": total_referrals,
        "total_interviews": total_interviews,
        "total_hired": total_hired,
        "employment_rate": round(successful_placements / total_jobseekers * 100, 1) if total_jobseekers else 0,
        "placement_rate": round(linked_hired / total_applicants * 100, 1) if total_applicants else 0,
        "unfilled_vacancies": unfilled_vacancies,
    }


KPI_LABELS = {
    "total_jobseekers": "Total Registered Jobseekers", "active_jobseekers": "Active Jobseekers",
    "total_employers": "Total Employers", "active_employers": "Active Employers",
    "total_vacancies": "Total Job Vacancies", "total_applicants": "Total Applicants",
    "total_referrals": "Total Referrals", "total_interviews": "Total Interviews",
    "total_hired": "Total Hired / Placed", "employment_rate": "Employment Rate (%)",
    "placement_rate": "Placement Rate (%)", "unfilled_vacancies": "Unfilled Vacancies",
}


# ---------- Jobseeker Labor Profile Analytics ----------

AGE_BRACKETS = [(15, 24), (25, 34), (35, 44), (45, 54), (55, 200)]


def build_jobseeker_profile_analytics(filters: LmiFilters) -> dict:
    profiles = _jobseeker_query(filters).all()

    age_counts = {f"{lo}-{hi}" if hi < 200 else f"{lo}+": 0 for lo, hi in AGE_BRACKETS}
    gender_counts, barangay_counts, municipality_counts = Counter(), Counter(), Counter()
    employment_status_counts, industry_counts, occupation_counts = Counter(), Counter(), Counter()
    technical_skill_counts, soft_skill_counts, cert_counts = Counter(), Counter(), Counter()
    work_exp_total = 0

    for p in profiles:
        age = p.age()
        if age is not None:
            for lo, hi in AGE_BRACKETS:
                if lo <= age <= hi:
                    age_counts[f"{lo}-{hi}" if hi < 200 else f"{lo}+"] += 1
                    break
        gender_counts[p.gender or "Unspecified"] += 1
        barangay_counts[p.barangay or "Unspecified"] += 1
        municipality_counts[p.municipality or "Unspecified"] += 1
        employment_status_counts[p.employment_status or "Unspecified"] += 1
        if p.preferred_industry:
            industry_counts[p.preferred_industry] += 1
        if p.preferred_job_position:
            occupation_counts[p.preferred_job_position] += 1
        for s in p.technical_skills or []:
            if s and s.strip():
                technical_skill_counts[s.strip().lower()] += 1
        for s in p.soft_skills or []:
            if s and s.strip():
                soft_skill_counts[s.strip().lower()] += 1
        for c in p.certifications or []:
            if c and c.strip():
                cert_counts[c.strip().lower()] += 1
        if p.work_experiences:
            work_exp_total += len(p.work_experiences)

    education_rows = (
        db.session.query(Education.attainment_level, func.count(Education.id))
        .join(JobseekerProfile, Education.profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_([p.id for p in profiles]) if profiles else False)
        .group_by(Education.attainment_level).all()
    )
    course_rows = (
        db.session.query(Education.degree, func.count(Education.id))
        .join(JobseekerProfile, Education.profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_([p.id for p in profiles]) if profiles else False, Education.degree.isnot(None))
        .group_by(Education.degree).order_by(func.count(Education.id).desc()).limit(10).all()
    )

    def _top(counter, n=10, title_case=True):
        return [{"label": (k.title() if title_case and k not in ("Unspecified",) else k), "count": v} for k, v in counter.most_common(n)]

    return {
        "total": len(profiles),
        "age_groups": [{"label": k, "count": v} for k, v in age_counts.items()],
        "gender": _top(gender_counts, 10, title_case=False),
        "barangay": _top(barangay_counts, 20, title_case=False),
        "municipality": _top(municipality_counts, 20, title_case=False),
        "educational_attainment": [{"label": lvl or "Unspecified", "count": c} for lvl, c in education_rows],
        "course": [{"label": deg or "Unspecified", "count": c} for deg, c in course_rows],
        "employment_status": _top(employment_status_counts, 10, title_case=False),
        "skills": _top(technical_skill_counts + soft_skill_counts, 15),
        "technical_skills": _top(technical_skill_counts, 15),
        "soft_skills": _top(soft_skill_counts, 15),
        "certifications": _top(cert_counts, 15),
        "work_experience_avg": round(work_exp_total / len(profiles), 1) if profiles else 0,
        "preferred_occupation": _top(occupation_counts, 10, title_case=False),
        "preferred_industry": _top(industry_counts, 10, title_case=False),
    }


# ---------- Job Demand & Vacancy Analytics ----------

def build_job_demand_analytics(filters: LmiFilters) -> dict:
    base = _vacancy_query(filters)
    total_vacancies = base.count()

    def _top(column, n=10):
        rows = base.with_entities(column, func.count(Vacancy.id)).group_by(column).order_by(func.count(Vacancy.id).desc()).all()
        return [{"label": lbl or "Unspecified", "count": cnt} for lbl, cnt in rows[:n]]

    by_occupation = _top(Vacancy.title)
    by_industry = _top(Vacancy.industry)

    by_employer_rows = (
        base.join(EmployerCompany, Vacancy.employer_company_id == EmployerCompany.id)
        .with_entities(EmployerCompany.company_name, func.count(Vacancy.id))
        .group_by(EmployerCompany.company_name).order_by(func.count(Vacancy.id).desc()).limit(10).all()
    )
    by_employer = [{"label": name or "Unnamed Company", "count": cnt} for name, cnt in by_employer_rows]

    most_in_demand_rows = (
        base.join(Application, Application.vacancy_id == Vacancy.id)
        .with_entities(Vacancy.title, func.count(Application.id))
        .group_by(Vacancy.id, Vacancy.title).order_by(func.count(Application.id).desc()).limit(10).all()
    )
    most_in_demand = [{"label": title, "count": cnt} for title, cnt in most_in_demand_rows]

    # Hard-to-fill: published >=30 days, application count still under num_slots.
    # A deliberately simpler, batched approximation for aggregate reporting — see
    # module docstring; not a replacement for vacancy_capacity_service's real-time
    # per-vacancy occupied-slots definition used on single-vacancy pages.
    cutoff = now_manila().date() - timedelta(days=HARD_TO_FILL_DAYS)
    app_counts_subq = (
        db.session.query(Application.vacancy_id, func.count(Application.id).label("app_count"))
        .group_by(Application.vacancy_id).subquery()
    )
    hard_to_fill_rows = (
        base.filter(Vacancy.status == "published")
        .filter(or_(Vacancy.posting_date <= cutoff, and_(Vacancy.posting_date.is_(None), Vacancy.created_at <= cutoff)))
        .outerjoin(app_counts_subq, app_counts_subq.c.vacancy_id == Vacancy.id)
        .filter(func.coalesce(app_counts_subq.c.app_count, 0) < Vacancy.num_slots)
        .with_entities(Vacancy.title, EmployerCompany.company_name, Vacancy.num_slots, func.coalesce(app_counts_subq.c.app_count, 0))
        .join(EmployerCompany, Vacancy.employer_company_id == EmployerCompany.id)
        .order_by(func.coalesce(app_counts_subq.c.app_count, 0).asc()).limit(15).all()
    )
    hard_to_fill = [
        {"title": t, "employer": e, "slots": s, "applications": a} for t, e, s, a in hard_to_fill_rows
    ]

    salary_rows = base.filter(Vacancy.salary_min.isnot(None)).with_entities(Vacancy.salary_min, Vacancy.salary_max).all()
    salary_buckets = Counter()
    for lo, hi in salary_rows:
        mid = float((lo + (hi or lo)) / 2)
        if mid < 10000:
            salary_buckets["Below ₱10,000"] += 1
        elif mid < 20000:
            salary_buckets["₱10,000–₱19,999"] += 1
        elif mid < 30000:
            salary_buckets["₱20,000–₱29,999"] += 1
        elif mid < 50000:
            salary_buckets["₱30,000–₱49,999"] += 1
        else:
            salary_buckets["₱50,000 and above"] += 1
    salary_range = [{"label": k, "count": v} for k, v in salary_buckets.items()]

    employment_type = _top(Vacancy.job_type)

    status_counts = dict(base.with_entities(Vacancy.status, func.count(Vacancy.id)).group_by(Vacancy.status).all())
    for s in VACANCY_STATUSES:
        status_counts.setdefault(s, 0)
    vacancy_status = [{"label": s.replace("_", " ").title(), "count": status_counts[s]} for s in VACANCY_STATUSES]
    # Same convention as dashboard_service.py::build_vacancy_analytics — "closed"
    # without ever being filled still counts as unfilled, not excluded.
    filled_vs_unfilled = {"filled": status_counts["filled"], "unfilled": status_counts["published"] + status_counts["closed"]}

    apps_per_vacancy_rows = (
        base.outerjoin(Application, Application.vacancy_id == Vacancy.id)
        .with_entities(Vacancy.title, func.count(Application.id)).group_by(Vacancy.id, Vacancy.title)
        .order_by(func.count(Application.id).desc()).limit(15).all()
    )
    applications_per_vacancy = [{"label": title, "count": cnt} for title, cnt in apps_per_vacancy_rows]

    return {
        "total_vacancies": total_vacancies,
        "by_occupation": by_occupation,
        "by_industry": by_industry,
        "by_employer": by_employer,
        "most_in_demand": most_in_demand,
        "hard_to_fill": hard_to_fill,
        "salary_range": salary_range,
        "employment_type": employment_type,
        "vacancy_status": vacancy_status,
        "filled_vs_unfilled": filled_vs_unfilled,
        "applications_per_vacancy": applications_per_vacancy,
    }


# ---------- Skills Demand & Skills Gap ----------

def build_skills_gap_analytics(filters: LmiFilters) -> dict:
    jobseeker_skill_counts = Counter()
    for tech, soft in _jobseeker_query(filters).with_entities(JobseekerProfile.technical_skills, JobseekerProfile.soft_skills).all():
        for s in (tech or []) + (soft or []):
            if s and s.strip():
                jobseeker_skill_counts[s.strip().lower()] += 1

    vacancy_skill_counts = Counter()
    for (required,) in _vacancy_query(filters).with_entities(Vacancy.required_skills).all():
        for s in required or []:
            if s and s.strip():
                vacancy_skill_counts[s.strip().lower()] += 1

    all_skills = set(jobseeker_skill_counts) | set(vacancy_skill_counts)
    gap_table = []
    for skill in all_skills:
        jobseekers = jobseeker_skill_counts.get(skill, 0)
        vacancies = vacancy_skill_counts.get(skill, 0)
        gap = vacancies - jobseekers
        if gap > 5:
            demand_level = "High"
        elif gap > 0:
            demand_level = "Medium"
        elif gap == 0:
            demand_level = "Balanced"
        else:
            demand_level = "Surplus"
        gap_table.append({
            "skill": skill.title(), "jobseekers": jobseekers, "vacancies": vacancies,
            "gap": gap, "demand_level": demand_level,
        })
    gap_table.sort(key=lambda r: -r["gap"])

    return {
        "top_skills_jobseekers": [{"label": k.title(), "count": v} for k, v in jobseeker_skill_counts.most_common(15)],
        "top_skills_employers": [{"label": k.title(), "count": v} for k, v in vacancy_skill_counts.most_common(15)],
        "gap_table": gap_table[:30],
    }


# ---------- Employment & Placement Funnel ----------

def build_employment_funnel(filters: LmiFilters) -> dict:
    registered = _jobseeker_query(filters).count()
    applied = _application_query(filters).with_entities(Application.jobseeker_profile_id).distinct().count()
    referred = _referral_query(filters).with_entities(ReferralLetter.jobseeker_profile_id).distinct().count()
    interviewed = (
        _interview_query(filters)
        .join(Application, Interview.application_id == Application.id)
        .with_entities(Application.jobseeker_profile_id).distinct().count()
    )
    # This funnel visualizes the online-application journey (Registered -> Applied
    # -> ... -> Hired), so its Hired/Employed stages are scoped to application-
    # linked EmploymentRecords only — a staff-entered walk-in hire never had an
    # Applied/Referred/Interviewed stage to begin with, and including it here
    # would make the funnel non-monotonic and its rates exceed 100%. The
    # "Total Hired / Placed" KPI card is the place walk-ins are counted; total
    # walk-in hires are surfaced separately below for transparency.
    linked_employment = _employment_query(filters).filter(EmploymentRecord.application_id.isnot(None))
    hired = linked_employment.with_entities(EmploymentRecord.jobseeker_profile_id).distinct().count()
    employed = linked_employment.filter(EmploymentRecord.status.in_(("active", "completed"))).with_entities(
        EmploymentRecord.jobseeker_profile_id
    ).distinct().count()
    walk_in_hires = _employment_query(filters).filter(EmploymentRecord.application_id.is_(None)).count()

    funnel = [
        {"stage": "Registered", "count": registered},
        {"stage": "Applied", "count": applied},
        {"stage": "Referred", "count": referred},
        {"stage": "Interviewed", "count": interviewed},
        {"stage": "Hired / Placed", "count": hired},
        {"stage": "Employed", "count": employed},
    ]

    # Time-to-placement: application-linked EmploymentRecords only (walk-ins,
    # application_id IS NULL, are excluded — see module docstring).
    linked = (
        _employment_query(filters)
        .filter(EmploymentRecord.application_id.isnot(None))
        .join(Application, EmploymentRecord.application_id == Application.id)
        .with_entities(EmploymentRecord.start_date, Application.created_at).all()
    )
    days = [(sd - ca.date()).days for sd, ca in linked if sd and ca]
    days = [d for d in days if d >= 0]
    time_to_placement_days = round(sum(days) / len(days), 1) if days else None

    # Every rate below is expressed against "Applied" (or "Registered" for
    # Employment Rate), not the immediately-prior funnel stage — Referred and
    # Interviewed are not strictly nested subsets of each other in this data
    # model (e.g. a "general" referral can exist with no application, and an
    # employer can interview an applicant PESO never issued a referral for),
    # so a stage-over-immediately-prior-stage rate can exceed 100% and mislead.
    # Applied is a genuine subset relationship for Interviewed/Hired (both FK
    # through Application), making it the one denominator every rate here can
    # be safely compared against.
    return {
        "funnel": funnel,
        "referral_rate": round(referred / applied * 100, 1) if applied else 0,
        "interview_rate": round(interviewed / applied * 100, 1) if applied else 0,
        "placement_rate": round(hired / applied * 100, 1) if applied else 0,
        "employment_rate": round(employed / registered * 100, 1) if registered else 0,
        "walk_in_hires": walk_in_hires,
        "time_to_placement_days": time_to_placement_days,
        "time_to_placement_n": len(days),
    }


# ---------- Employer & Industry Analytics ----------

def build_employer_industry_analytics(filters: LmiFilters) -> dict:
    """Batched (not per-employer/per-industry looped) — this endpoint previously
    issued ~7 queries per employer plus another ~5 per industry, which is cheap
    computationally but was measured taking 20+ seconds against the app's
    remote Postgres instance purely from round-trip latency multiplying. Every
    metric below is now one grouped query across all employers at once,
    merged in Python (no further DB round trips)."""
    employers = _employer_query(filters).all()
    employer_ids = [e.id for e in employers]
    if not employer_ids:
        return {"by_employer": [], "top_hiring_employers": [], "by_industry": []}

    vac_status_rows = (
        _vacancy_query(filters)
        .filter(Vacancy.employer_company_id.in_(employer_ids))
        .with_entities(Vacancy.employer_company_id, Vacancy.status, func.count(Vacancy.id))
        .group_by(Vacancy.employer_company_id, Vacancy.status).all()
    )
    vac_by_employer = {}
    for emp_id, status, cnt in vac_status_rows:
        agg = vac_by_employer.setdefault(emp_id, {"total": 0, "filled": 0, "unfilled": 0})
        agg["total"] += cnt
        if status == "filled":
            agg["filled"] += cnt
        elif status in ("published", "closed"):
            agg["unfilled"] += cnt

    applicants_by_employer = dict(
        db.session.query(Vacancy.employer_company_id, func.count(Application.id))
        .join(Application, Application.vacancy_id == Vacancy.id)
        .filter(Vacancy.employer_company_id.in_(employer_ids), Vacancy.deleted_at.is_(None))
        .group_by(Vacancy.employer_company_id).all()
    )
    referrals_by_employer = dict(
        db.session.query(Vacancy.employer_company_id, func.count(ReferralLetter.id))
        .join(ReferralLetter, ReferralLetter.vacancy_id == Vacancy.id)
        .filter(Vacancy.employer_company_id.in_(employer_ids), ReferralLetter.status == "approved")
        .group_by(Vacancy.employer_company_id).all()
    )
    interviews_by_employer = dict(
        db.session.query(Vacancy.employer_company_id, func.count(Interview.id))
        .join(Application, Interview.application_id == Application.id)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Vacancy.employer_company_id.in_(employer_ids))
        .group_by(Vacancy.employer_company_id).all()
    )
    hires_by_employer = dict(
        db.session.query(EmploymentRecord.employer_company_id, func.count(EmploymentRecord.id))
        .filter(EmploymentRecord.employer_company_id.in_(employer_ids))
        .group_by(EmploymentRecord.employer_company_id).all()
    )
    jobseekers_pref_by_industry = dict(
        db.session.query(JobseekerProfile.preferred_industry, func.count(JobseekerProfile.id))
        .filter(JobseekerProfile.preferred_industry.isnot(None))
        .group_by(JobseekerProfile.preferred_industry).all()
    )

    employer_rows = []
    industry_totals = {}
    for emp in employers:
        vac = vac_by_employer.get(emp.id, {"total": 0, "filled": 0, "unfilled": 0})
        applicants = applicants_by_employer.get(emp.id, 0)
        hires = hires_by_employer.get(emp.id, 0)
        industry = emp.industry or "Unspecified"
        agg = industry_totals.setdefault(industry, {"vacancies": 0, "filled": 0, "unfilled": 0, "applicants": 0, "placements": 0})
        agg["vacancies"] += vac["total"]
        agg["filled"] += vac["filled"]
        agg["unfilled"] += vac["unfilled"]
        agg["applicants"] += applicants
        agg["placements"] += hires
        if vac["total"] == 0 and hires == 0 and applicants == 0:
            continue
        employer_rows.append({
            "employer": emp.company_name or "Unnamed Company", "industry": industry,
            "vacancies": vac["total"], "filled": vac["filled"], "unfilled": vac["unfilled"],
            "applicants": applicants, "referrals": referrals_by_employer.get(emp.id, 0),
            "interviews": interviews_by_employer.get(emp.id, 0), "hires": hires,
        })
    employer_rows.sort(key=lambda r: -r["hires"])
    top_hiring_employers = [{"label": r["employer"], "count": r["hires"]} for r in employer_rows if r["hires"] > 0][:10]

    industry_rows = [
        {
            "industry": industry, "jobseekers": jobseekers_pref_by_industry.get(industry, 0),
            "vacancies": agg["vacancies"], "applicants": agg["applicants"], "placements": agg["placements"],
            "filled": agg["filled"], "unfilled": agg["unfilled"],
        }
        for industry, agg in industry_totals.items()
    ]
    industry_rows.sort(key=lambda r: -r["vacancies"])

    return {
        "by_employer": employer_rows[:30],
        "top_hiring_employers": top_hiring_employers,
        "by_industry": industry_rows[:20],
    }


# ---------- Barangay Labor Market Analytics ----------

def build_barangay_analytics(filters: LmiFilters) -> dict:
    """Batched (not one query set per barangay) — see build_employer_industry_
    analytics's docstring for why this matters against a remote DB. All
    jobseeker profiles matching the filters are fetched once and grouped by
    barangay in memory; every cross-entity count (applicants/referrals/
    interviews/hired/vacancies) is one GROUP BY query across all barangays."""
    profiles = _jobseeker_query(filters).all()
    profiles_by_barangay = {}
    for p in profiles:
        if p.barangay:
            profiles_by_barangay.setdefault(p.barangay, []).append(p)
    if not profiles_by_barangay:
        return {"barangays": []}

    all_profile_ids = [p.id for profs in profiles_by_barangay.values() for p in profs]

    active_by_barangay = dict(
        db.session.query(JobseekerProfile.barangay, func.count(JobseekerProfile.id))
        .join(User, JobseekerProfile.user_id == User.id)
        .filter(JobseekerProfile.id.in_(all_profile_ids), User.is_active.is_(True))
        .group_by(JobseekerProfile.barangay).all()
    )
    vacancies_by_barangay = dict(
        db.session.query(Vacancy.barangay_name, func.count(Vacancy.id))
        .filter(Vacancy.barangay_name.in_(profiles_by_barangay.keys()), Vacancy.deleted_at.is_(None))
        .group_by(Vacancy.barangay_name).all()
    )
    applicants_by_barangay = dict(
        db.session.query(JobseekerProfile.barangay, func.count(Application.id))
        .join(Application, Application.jobseeker_profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_(all_profile_ids))
        .group_by(JobseekerProfile.barangay).all()
    )
    referrals_by_barangay = dict(
        db.session.query(JobseekerProfile.barangay, func.count(ReferralLetter.id))
        .join(ReferralLetter, ReferralLetter.jobseeker_profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_(all_profile_ids), ReferralLetter.status == "approved")
        .group_by(JobseekerProfile.barangay).all()
    )
    interviews_by_barangay = dict(
        db.session.query(JobseekerProfile.barangay, func.count(Interview.id))
        .join(Application, Interview.application_id == Application.id)
        .join(JobseekerProfile, Application.jobseeker_profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_(all_profile_ids))
        .group_by(JobseekerProfile.barangay).all()
    )
    # Distinct jobseekers, not row count — a jobseeker can have more than one
    # EmploymentRecord (re-hires), which would otherwise let this exceed the
    # barangay's own jobseeker count and push employment_rate past 100%.
    hired_rows = (
        db.session.query(JobseekerProfile.barangay, EmploymentRecord.jobseeker_profile_id)
        .join(EmploymentRecord, EmploymentRecord.jobseeker_profile_id == JobseekerProfile.id)
        .filter(JobseekerProfile.id.in_(all_profile_ids)).distinct().all()
    )
    hired_by_barangay = Counter(brgy for brgy, _ in hired_rows)

    rows = []
    for brgy, profs in profiles_by_barangay.items():
        jobseekers = len(profs)
        employed = sum(1 for p in profs if p.employment_status == "Employed")
        unemployed = sum(1 for p in profs if p.employment_status == "Unemployed")
        applicants = applicants_by_barangay.get(brgy, 0)
        hired = hired_by_barangay.get(brgy, 0)

        skill_counts = Counter()
        job_counts = Counter()
        for p in profs:
            for s in (p.technical_skills or []) + (p.soft_skills or []):
                if s and s.strip():
                    skill_counts[s.strip().lower()] += 1
            if p.preferred_job_position:
                job_counts[p.preferred_job_position] += 1

        rows.append({
            "barangay": brgy, "jobseekers": jobseekers, "active_jobseekers": active_by_barangay.get(brgy, 0),
            "employed": employed, "unemployed": unemployed,
            "vacancies": vacancies_by_barangay.get(brgy, 0), "applicants": applicants,
            "referrals": referrals_by_barangay.get(brgy, 0), "interviews": interviews_by_barangay.get(brgy, 0),
            "hired": hired,
            "employment_rate": round(hired / jobseekers * 100, 1) if jobseekers else 0,
            "placement_rate": round(hired / applicants * 100, 1) if applicants else 0,
            "top_skills": ", ".join(k.title() for k, _ in skill_counts.most_common(3)) or "—",
            "top_jobs": ", ".join(k for k, _ in job_counts.most_common(3)) or "—",
        })
    rows.sort(key=lambda r: -r["jobseekers"])
    return {"barangays": rows}


def build_filter_options() -> dict:
    """Populates the filter bar's dropdowns with real, currently-existing values
    — Employer and Job Category filter on a UUID (employer_company_id/
    category_id), so those two MUST be dropdowns fed from real rows rather than
    free text; Barangay/Municipality/Industry are exposed the same way here so
    the UI can offer a dropdown instead of requiring an exact free-text match
    against inconsistently-typed data (see module docstring's barangay caveat)."""
    barangays = sorted({b for (b,) in db.session.query(JobseekerProfile.barangay).distinct().all() if b})
    municipalities = sorted({m for (m,) in db.session.query(JobseekerProfile.municipality).distinct().all() if m})
    industries = sorted({
        i for (i,) in db.session.query(Vacancy.industry).filter(Vacancy.deleted_at.is_(None)).distinct().all() if i
    } | {i for (i,) in db.session.query(EmployerCompany.industry).distinct().all() if i})
    employers = [
        {"id": str(e.id), "name": e.company_name or "Unnamed Company"}
        for e in EmployerCompany.query.order_by(EmployerCompany.company_name).all()
    ]
    job_categories = [{"id": str(c.id), "name": c.name} for c in VacancyCategory.query.filter_by(is_active=True).order_by(VacancyCategory.name).all()]
    return {
        "barangays": barangays, "municipalities": municipalities, "industries": industries,
        "employers": employers, "job_categories": job_categories,
    }


def notify_lmi_update(reason: str) -> None:
    """Silent real-time refetch signal — no DB write, just a socket emit (built
    on the existing notify_role primitive). Called from the 7 mutation points
    identified across the app (registration, vacancy publish, referral
    approval, interview creation, hiring, profile edits) so both the Staff and
    Admin LMI dashboards refresh live without polling being the only path."""
    payload = {"reason": reason, "ts": now_manila().isoformat()}
    notify_role("staff", "lmi:data_updated", payload)
    notify_role("admin", "lmi:data_updated", payload)


# ---------- Excel export ----------

def build_lmi_excel(filters: LmiFilters):
    kpi = build_kpi_summary(filters)
    jobseeker = build_jobseeker_profile_analytics(filters)
    demand = build_job_demand_analytics(filters)
    skills = build_skills_gap_analytics(filters)
    funnel = build_employment_funnel(filters)
    employer_industry = build_employer_industry_analytics(filters)
    barangay = build_barangay_analytics(filters)

    sheets = []

    summary_rows = [[label, value] for label, value in filters_display(filters)]
    summary_rows.append(["", ""])
    summary_rows += [[KPI_LABELS[k], v] for k, v in kpi.items()]
    sheets.append(("Executive Summary", ["Metric", "Value"], summary_rows))

    jobseeker_columns = [
        "Registration #", "Full Name", "Age", "Gender", "Barangay", "Municipality", "Province",
        "Educational Attainment", "Employment Status", "Preferred Occupation", "Preferred Industry",
        "Technical Skills", "Soft Skills", "Certifications",
    ]
    jobseeker_rows = []
    for idx, p in enumerate(_jobseeker_query(filters).limit(5000).all(), start=1):
        attainment = p.educations[0].attainment_level if p.educations else ""
        jobseeker_rows.append([
            f"JS-{idx:06d}", p.full_name, p.age() or "", p.gender or "", p.barangay or "", p.municipality or "",
            p.province or "", attainment or "", p.employment_status or "", p.preferred_job_position or "",
            p.preferred_industry or "", ", ".join(p.technical_skills or []), ", ".join(p.soft_skills or []),
            ", ".join(p.certifications or []),
        ])
    sheets.append(("Jobseeker Profile", jobseeker_columns, jobseeker_rows))

    vacancy_columns = ["Job Title", "Employer", "Industry", "Employment Type", "Location", "Salary Range", "Status", "Applicants", "Referrals", "Interviews", "Hired", "Filled/Unfilled"]
    vacancy_rows = []
    for v in _vacancy_query(filters).limit(5000).all():
        applicants = Application.query.filter_by(vacancy_id=v.id).count()
        referrals = ReferralLetter.query.filter_by(vacancy_id=v.id, status="approved").count()
        interviews = Interview.query.join(Application, Interview.application_id == Application.id).filter(Application.vacancy_id == v.id).count()
        hired = Application.query.filter_by(vacancy_id=v.id, status="hired").count()
        salary = (f"₱{v.salary_min:,.0f}–₱{v.salary_max:,.0f}" if v.salary_min and v.salary_max else "Not specified") if not v.hide_salary else "Confidential"
        vacancy_rows.append([
            v.title, v.employer_company.company_name if v.employer_company else "", v.industry or "",
            (v.job_type or "").replace("_", " ").title(), v.city_municipality_name or v.work_location or "",
            salary, v.status.title(), applicants, referrals, interviews, hired,
            "Filled" if v.status == "filled" else "Unfilled",
        ])
    sheets.append(("Job Demand-Vacancies", vacancy_columns, vacancy_rows))

    employer_columns = ["Employer", "Industry", "Vacancies", "Applicants", "Referrals", "Interviews", "Hired", "Filled", "Unfilled"]
    employer_rows = [
        [r["employer"], r["industry"], r["vacancies"], r["applicants"], r["referrals"], r["interviews"], r["hires"], r["filled"], r["unfilled"]]
        for r in employer_industry["by_employer"]
    ]
    sheets.append(("Employer Analysis", employer_columns, employer_rows))

    sheets.append(("Skills Demand", ["Skill", "Jobseekers", "Vacancies", "Demand Level"], [
        [row["skill"], row["jobseekers"], row["vacancies"], row["demand_level"]] for row in skills["gap_table"]
    ]))
    sheets.append(("Skills Gap", ["Skill", "Jobseeker Supply", "Employer Demand", "Gap", "Demand Level"], [
        [row["skill"], row["jobseekers"], row["vacancies"], row["gap"], row["demand_level"]] for row in skills["gap_table"]
    ]))

    funnel_rows = [[f["stage"], f["count"]] for f in funnel["funnel"]]
    funnel_rows += [
        ["Referral Rate (%)", funnel["referral_rate"]], ["Interview Rate (%)", funnel["interview_rate"]],
        ["Placement Rate (%)", funnel["placement_rate"]], ["Employment Rate (%)", funnel["employment_rate"]],
        ["Time-to-Placement (days, application-linked only, N=" + str(funnel["time_to_placement_n"]) + ")", funnel["time_to_placement_days"] or "Insufficient data"],
    ]
    sheets.append(("Employment and Placement", ["Metric", "Value"], funnel_rows))

    barangay_columns = ["Barangay", "Jobseekers", "Active Jobseekers", "Employed", "Unemployed", "Applicants", "Referrals", "Interviews", "Hired/Placed", "Employment Rate (%)", "Placement Rate (%)", "Top Skills", "Most In-Demand Jobs"]
    barangay_rows = [
        [r["barangay"], r["jobseekers"], r["active_jobseekers"], r["employed"], r["unemployed"], r["applicants"], r["referrals"],
         r["interviews"], r["hired"], r["employment_rate"], r["placement_rate"], r["top_skills"], r["top_jobs"]]
        for r in barangay["barangays"]
    ]
    sheets.append(("Barangay Analysis", barangay_columns, barangay_rows))

    industry_columns = ["Industry/Sector", "Jobseekers", "Vacancies", "Applicants", "Placements", "Filled", "Unfilled"]
    industry_rows = [
        [r["industry"], r["jobseekers"], r["vacancies"], r["applicants"], r["placements"], r["filled"], r["unfilled"]]
        for r in employer_industry["by_industry"]
    ]
    sheets.append(("Industry Analysis", industry_columns, industry_rows))

    return build_multi_sheet_excel_report(sheets, landscape=True)


# ---------- PDF export ----------

def build_lmi_pdf(filters: LmiFilters, generated_by: str) -> bytes:
    from services.pdf_service import generate_lmi_report

    kpi = build_kpi_summary(filters)
    jobseeker = build_jobseeker_profile_analytics(filters)
    demand = build_job_demand_analytics(filters)
    skills = build_skills_gap_analytics(filters)
    funnel = build_employment_funnel(filters)
    employer_industry = build_employer_industry_analytics(filters)
    barangay = build_barangay_analytics(filters)
    date_str = now_manila().strftime("%B %d, %Y %I:%M %p")

    return generate_lmi_report(
        kpi=kpi, jobseeker=jobseeker, demand=demand, skills=skills, funnel=funnel,
        employer_industry=employer_industry, barangay=barangay,
        filters_lines=filters_display(filters), date_str=date_str, generated_by=generated_by,
    )
