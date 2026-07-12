"""Company-scoped mirror of services/dashboard_service.py's summary/analytics/export
pattern — same query techniques (month-bucketing, funnel-scaffolding against the
model's own status tuple, build_multi_sheet_excel_report/generate_dashboard_report
reuse), just filtered down to one employer_company_id instead of platform-wide.

Built against the vacancy status enum as it exists today (pending|active|rejected|
closed); Phase 6 lands a small follow-up patch once the new draft/approved/
published/suspended/filled states exist, per the plan's two-pass note.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import func

from extensions import db
from models.application import APPLICATION_STATUSES, Application
from models.audit import AuditTrail
from models.employment import EmploymentRecord
from models.interview import Interview
from models.vacancy import Vacancy
from services.excel_service import build_multi_sheet_excel_report
from services.pdf_service import generate_employer_dashboard_report
from utils.timezone import now_manila


def _month_buckets(n: int):
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


def _vacancy_ids(company_id):
    return [v.id for v in Vacancy.query.filter_by(employer_company_id=company_id).with_entities(Vacancy.id).all()]


def build_summary(company) -> dict:
    from services.profile_completion_service import COMPANY_REQUIRED_FIELDS, compute_completion

    vacancy_ids = _vacancy_ids(company.id)
    today_start = now_manila().date()

    total_applicants = Application.query.filter(Application.vacancy_id.in_(vacancy_ids)).count() if vacancy_ids else 0
    new_applicants_today = (
        Application.query.filter(Application.vacancy_id.in_(vacancy_ids), Application.created_at >= today_start).count()
        if vacancy_ids else 0
    )
    hired_applicants = (
        Application.query.filter(Application.vacancy_id.in_(vacancy_ids), Application.status == "hired").count()
        if vacancy_ids else 0
    )
    scheduled_interviews = (
        db.session.query(Interview)
        .join(Application, Interview.application_id == Application.id)
        .filter(Application.vacancy_id.in_(vacancy_ids), Interview.status.in_(("pending", "accepted")), Interview.scheduled_date >= now_manila())
        .count()
        if vacancy_ids else 0
    )

    return {
        "active_vacancies": Vacancy.query.filter_by(employer_company_id=company.id, status="published").count(),
        "total_applicants": total_applicants,
        "new_applicants_today": new_applicants_today,
        "scheduled_interviews": scheduled_interviews,
        "hired_applicants": hired_applicants,
        "pending_vacancies": Vacancy.query.filter_by(employer_company_id=company.id, status="pending").count(),
        "closed_vacancies": Vacancy.query.filter_by(employer_company_id=company.id, status="closed").count(),
        "company_profile_completion": compute_completion(company, COMPANY_REQUIRED_FIELDS)["profile_completion"],
        "accreditation_status": company.accreditation_status,
    }


def build_analytics(company, months: int = 6, date_from: str | None = None, date_to: str | None = None) -> dict:
    end_date = None
    if date_from and date_to:
        start_date = date.fromisoformat(date_from)
        end_date = date.fromisoformat(date_to)
        buckets = []
        y, m = start_date.year, start_date.month
        while (y, m) <= (end_date.year, end_date.month):
            buckets.append((y, m))
            m += 1
            if m == 13:
                m, y = 1, y + 1
    else:
        months = min(max(months, 1), 12)
        buckets = _month_buckets(months)
        start_date = date(buckets[0][0], buckets[0][1], 1)
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]

    def _bounded(column):
        conditions = [column >= start_date]
        if end_date:
            conditions.append(column <= end_date)
        return conditions

    vacancy_ids = _vacancy_ids(company.id)
    vacancies = Vacancy.query.filter_by(employer_company_id=company.id).all()

    # Applications per Vacancy (top 10 by volume)
    app_counts = dict(
        db.session.query(Application.vacancy_id, func.count(Application.id))
        .filter(Application.vacancy_id.in_(vacancy_ids)).group_by(Application.vacancy_id).all()
    ) if vacancy_ids else {}
    applications_per_vacancy = sorted(
        [{"vacancy": v.title, "count": app_counts.get(v.id, 0)} for v in vacancies],
        key=lambda r: -r["count"],
    )[:10]

    # Applicant Status distribution (scaffolded against the model's own status tuple)
    status_rows = dict(
        db.session.query(Application.status, func.count(Application.id))
        .filter(Application.vacancy_id.in_(vacancy_ids)).group_by(Application.status).all()
    ) if vacancy_ids else {}
    applicant_status = [{"status": s, "count": status_rows.get(s, 0)} for s in APPLICATION_STATUSES]

    # Monthly Applications
    app_month_rows = dict(
        db.session.query(func.to_char(Application.created_at, "YYYY-MM"), func.count(Application.id))
        .filter(Application.vacancy_id.in_(vacancy_ids), *_bounded(Application.created_at))
        .group_by(func.to_char(Application.created_at, "YYYY-MM")).all()
    ) if vacancy_ids else {}
    monthly_applications = [{"month": lbl, "count": app_month_rows.get(lbl, 0)} for lbl in labels]

    # Hiring Funnel: Applications -> Shortlisted (under_review) -> Interviewed -> Hired
    interview_count = (
        db.session.query(Interview).join(Application, Interview.application_id == Application.id)
        .filter(Application.vacancy_id.in_(vacancy_ids)).count()
        if vacancy_ids else 0
    )
    hiring_funnel = [
        {"stage": "Applications", "count": sum(status_rows.values())},
        {"stage": "Shortlisted", "count": status_rows.get("under_review", 0) + status_rows.get("interview_scheduled", 0) + status_rows.get("hired", 0)},
        {"stage": "Interviewed", "count": interview_count},
        {"stage": "Hired", "count": status_rows.get("hired", 0)},
    ]

    return {
        "applications_per_vacancy": applications_per_vacancy,
        "applicant_status": applicant_status,
        "monthly_applications": monthly_applications,
        "hiring_funnel": hiring_funnel,
    }


def build_pending_actions(company, hr_profile) -> dict:
    from services.profile_completion_service import COMPANY_REQUIRED_FIELDS, HR_REQUIRED_FIELDS, compute_completion

    company_completion = compute_completion(company, COMPANY_REQUIRED_FIELDS)
    hr_completion = compute_completion(hr_profile, HR_REQUIRED_FIELDS) if hr_profile else {"profile_completion": 0, "missing_fields": []}
    missing_mandatory_docs = [
        f["label"] for f in company_completion["missing_fields"] if f["section"] == "documents"
    ] + [
        f["label"] for f in hr_completion["missing_fields"] if f["section"] == "documents"
    ]

    return {
        "complete_company_profile": company_completion["profile_completion"] < 100,
        "complete_hr_profile": hr_completion["profile_completion"] < 100,
        "missing_documents": missing_mandatory_docs,
        "can_submit_accreditation": company.accreditation_status in ("not_submitted", "rejected") and company_completion["profile_completion"] == 100,
        "accreditation_status": company.accreditation_status,
        "vacancies_awaiting_approval": Vacancy.query.filter_by(employer_company_id=company.id, status="pending").count(),
    }


def build_recent_applicants(company, limit: int = 10):
    vacancy_ids = _vacancy_ids(company.id)
    if not vacancy_ids:
        return []
    apps = (
        Application.query.filter(Application.vacancy_id.in_(vacancy_ids))
        .order_by(Application.created_at.desc()).limit(limit).all()
    )
    return [a.to_dict() for a in apps]


def build_recent_activity(company, limit: int = 10):
    entries = (
        AuditTrail.query.filter_by(user_id=company.user_id)
        .order_by(AuditTrail.created_at.desc()).limit(limit).all()
    )
    return [e.to_dict() for e in entries]


def build_company_insights(company) -> dict:
    vacancy_ids = _vacancy_ids(company.id)
    total_vacancies = len(vacancy_ids)
    total_applications = Application.query.filter(Application.vacancy_id.in_(vacancy_ids)).count() if vacancy_ids else 0
    hired_count = (
        Application.query.filter(Application.vacancy_id.in_(vacancy_ids), Application.status == "hired").count()
        if vacancy_ids else 0
    )

    hired_records = (
        db.session.query(Application.created_at, EmploymentRecord.start_date)
        .join(EmploymentRecord, EmploymentRecord.application_id == Application.id)
        .filter(Application.vacancy_id.in_(vacancy_ids))
        .all()
        if vacancy_ids else []
    )
    if hired_records:
        deltas = [(sd - ca.date()).days for ca, sd in hired_records if sd]
        avg_hiring_days = round(sum(deltas) / len(deltas), 1) if deltas else None
    else:
        avg_hiring_days = None

    vacancies_with_hire = (
        db.session.query(Application.vacancy_id).filter(Application.vacancy_id.in_(vacancy_ids), Application.status == "hired")
        .distinct().count()
        if vacancy_ids else 0
    )

    return {
        "employees_hired": hired_count,
        "avg_hiring_time_days": avg_hiring_days,
        "acceptance_rate": round(hired_count / total_applications * 100, 1) if total_applications else 0,
        "vacancy_fill_rate": round(vacancies_with_hire / total_vacancies * 100, 1) if total_vacancies else 0,
    }


def build_employer_dashboard_excel(company, args):
    scope = args.get("scope", "both")
    months = int(args.get("months", 6))
    sheets = []

    if scope in ("summary", "both"):
        summary = build_summary(company)
        sheets.append(("Summary", ["Metric", "Value"], [[k, v] for k, v in summary.items()]))
        insights = build_company_insights(company)
        sheets.append(("Company Insights", ["Metric", "Value"], [[k, v] for k, v in insights.items()]))

    if scope in ("analytics", "both"):
        analytics = build_analytics(company, months, args.get("date_from"), args.get("date_to"))
        sheets.append(("Applications per Vacancy", ["Vacancy", "Applications"],
                       [[r["vacancy"], r["count"]] for r in analytics["applications_per_vacancy"]]))
        sheets.append(("Applicant Status", ["Status", "Count"],
                       [[r["status"], r["count"]] for r in analytics["applicant_status"]]))
        sheets.append(("Monthly Applications", ["Month", "Applications"],
                       [[r["month"], r["count"]] for r in analytics["monthly_applications"]]))
        sheets.append(("Hiring Funnel", ["Stage", "Count"],
                       [[r["stage"], r["count"]] for r in analytics["hiring_funnel"]]))

    return build_multi_sheet_excel_report(sheets)


def build_employer_dashboard_pdf(company, args, generated_by: str) -> bytes:
    scope = args.get("scope", "both")
    months = int(args.get("months", 6))
    summary = build_summary(company) if scope in ("summary", "both") else None
    analytics = build_analytics(company, months, args.get("date_from"), args.get("date_to")) if scope in ("analytics", "both") else None
    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    return generate_employer_dashboard_report(summary, analytics, company.company_name or "Company", date_str, generated_by)
