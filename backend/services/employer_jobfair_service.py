"""Employer-side job fair participation reporting — backs the "My
Participations" page and its Excel/PDF exports. Mirrors the
employer_dashboard_service.py export scaffold (build_*(company, args) ->
BytesIO/bytes, blueprint handles send_file + log_audit)."""

from models.application import Application
from models.jobfair import JobFairBooth, JobFairRegistration
from models.vacancy import Vacancy
from services.application_stats_service import bucket_application_stats
from services.excel_service import build_excel_report
from services.pdf_service import generate_table_report

PARTICIPATION_COLUMNS = [
    "Job Fair", "Event Date", "Venue", "Job Fair Status", "Booth Status",
    "Assigned Vacancies", "Booth Visitors", "Interviews", "Hired",
]


def _attendance_summary(company_id, jobfair_id):
    """Booth-level event-day stats, approximated from existing data (no
    per-booth QR scan model exists — see plan notes): booth visitors are
    fair-attended registrants who applied to this employer's fair-tagged
    vacancies; interviews/hired reuse the same status buckets as item 2/3."""
    vacancy_ids = [
        v.id for v in Vacancy.query.filter_by(employer_company_id=company_id, tagged_for_jobfair_id=jobfair_id).all()
    ]
    if not vacancy_ids:
        return {"booth_visitors": 0, **bucket_application_stats([])}

    applications = Application.query.filter(Application.vacancy_id.in_(vacancy_ids)).all()
    stats = bucket_application_stats(applications)
    jobseeker_ids = {a.jobseeker_profile_id for a in applications}
    visitors = 0
    if jobseeker_ids:
        visitors = JobFairRegistration.query.filter(
            JobFairRegistration.jobfair_id == jobfair_id,
            JobFairRegistration.jobseeker_profile_id.in_(jobseeker_ids),
            JobFairRegistration.attended.is_(True),
        ).count()
    return {"booth_visitors": visitors, **stats}


def build_participations(company):
    booths = JobFairBooth.query.filter_by(employer_company_id=company.id).order_by(JobFairBooth.created_at.desc()).all()
    result = []
    for booth in booths:
        fair = booth.jobfair
        vacancy_count = Vacancy.query.filter_by(
            employer_company_id=company.id, tagged_for_jobfair_id=fair.id, status="published",
        ).count()
        result.append({
            "booth_id": str(booth.id),
            "jobfair_id": str(fair.id),
            "jobfair_name": fair.name,
            "event_date": fair.event_date.isoformat() if fair.event_date else None,
            "venue": fair.venue,
            "jobfair_status": fair.status,
            "booth_status": booth.status,
            "review_remarks": booth.review_remarks,
            "assigned_vacancy_count": vacancy_count,
            "attendance_summary": _attendance_summary(company.id, fair.id) if booth.status == "confirmed" else None,
        })
    return result


def _participation_rows(company):
    rows = []
    for p in build_participations(company):
        summary = p["attendance_summary"] or {}
        rows.append([
            p["jobfair_name"],
            p["event_date"][:10] if p["event_date"] else "",
            p["venue"],
            p["jobfair_status"],
            p["booth_status"],
            p["assigned_vacancy_count"],
            summary.get("booth_visitors", 0),
            summary.get("interviews", 0),
            summary.get("hired", 0),
        ])
    return rows


def build_participations_excel(company):
    return build_excel_report("My Job Fair Participations", PARTICIPATION_COLUMNS, _participation_rows(company))


def build_participations_pdf(company, date_str):
    return generate_table_report("My Job Fair Participations", PARTICIPATION_COLUMNS, _participation_rows(company), date_str)
