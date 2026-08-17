"""KPI aggregation + analytics for the DILP module — mirrors owwa_reporting_service.py's
shape (itself modeled on dashboard_service.py's efficient grouped-query style).
"""

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.dilp import DILP_STATUSES, DilpApplication, DilpApplicationRemark
from models.jobseeker import JobseekerProfile
from services.dashboard_service import _month_buckets
from utils.timezone import manila_day_bounds, to_manila

# Statuses reachable only once an interview has actually been scheduled — used as the
# denominator for the no-show rate (an application that never got scheduled can't have
# been a no-show).
EVER_SCHEDULED_STATUSES = ("scheduled", "completed", "no_show", "ready_for_claiming", "approved", "submitted_to_esfo")
REPORT_ROW_LIMIT = 20000


def build_dilp_stats() -> dict:
    status_counts = dict(db.session.query(DilpApplication.status, func.count(DilpApplication.id)).group_by(DilpApplication.status).all())
    for s in DILP_STATUSES:
        status_counts.setdefault(s, 0)

    resolved = (
        db.session.query(DilpApplication.created_at, DilpApplication.submitted_to_esfo_at)
        .filter(DilpApplication.submitted_to_esfo_at.isnot(None))
        .all()
    )
    day_spans = [(row.submitted_to_esfo_at.date() - row.created_at.date()).days for row in resolved if row.created_at]
    avg_pending_to_esfo_days = round(sum(day_spans) / len(day_spans), 1) if day_spans else None

    # No-show rate = applications that were ever marked no-show at least once, divided by
    # applications that ever reached "scheduled" or later (an application still stuck at
    # "pending" was never given the chance to be a no-show, so it's excluded).
    ever_scheduled = sum(status_counts[s] for s in EVER_SCHEDULED_STATUSES)
    ever_no_show = db.session.query(func.count(DilpApplication.id)).filter(DilpApplication.no_show_count > 0).scalar() or 0
    no_show_rate = round((ever_no_show / ever_scheduled) * 100, 1) if ever_scheduled else None

    return {
        "total_applications": sum(status_counts.values()),
        "pending": status_counts["pending"],
        "scheduled": status_counts["scheduled"],
        "completed": status_counts["completed"],
        "no_show": status_counts["no_show"],
        "ready_for_claiming": status_counts["ready_for_claiming"],
        "approved": status_counts["approved"],
        "submitted_to_esfo": status_counts["submitted_to_esfo"],
        "avg_pending_to_esfo_days": avg_pending_to_esfo_days,
        "no_show_rate": no_show_rate,
    }


def build_dilp_analytics(months: int = 6) -> dict:
    buckets = _month_buckets(min(max(months, 1), 12))
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]
    from datetime import date
    start_date = date(buckets[0][0], buckets[0][1], 1)

    month_rows = dict(
        db.session.query(func.to_char(DilpApplication.created_at, "YYYY-MM"), func.count(DilpApplication.id))
        .filter(DilpApplication.created_at >= start_date)
        .group_by(func.to_char(DilpApplication.created_at, "YYYY-MM"))
        .all()
    )
    applications_per_month = [{"month": lbl, "count": month_rows.get(lbl, 0)} for lbl in labels]

    status_counts = dict(db.session.query(DilpApplication.status, func.count(DilpApplication.id)).group_by(DilpApplication.status).all())
    status_distribution = [
        {"label": s.replace("_", " ").title(), "count": status_counts.get(s, 0)} for s in DILP_STATUSES
    ]

    return {"applications_per_month": applications_per_month, "status_distribution": status_distribution}


def query_dilp_applications_for_report(status=None, search=None, date_from=None, date_to=None):
    query = DilpApplication.query.options(
        selectinload(DilpApplication.jobseeker_profile).selectinload(JobseekerProfile.user),
        selectinload(DilpApplication.remarks).selectinload(DilpApplicationRemark.staff),
    )
    if status:
        query = query.filter(DilpApplication.status == status)
    if search:
        query = query.join(JobseekerProfile).filter(JobseekerProfile.full_name.ilike(f"%{search}%"))
    start, end = manila_day_bounds(date_from, date_to)
    if start:
        query = query.filter(DilpApplication.created_at >= start)
    if end:
        query = query.filter(DilpApplication.created_at < end)
    return query.order_by(DilpApplication.created_at.desc()).limit(REPORT_ROW_LIMIT).all()


def _to_manila_or_none(dt):
    return to_manila(dt) if dt is not None else None


def dilp_report_row(dilp_app: DilpApplication) -> dict:
    """Every datetime field is converted via to_manila() before being returned — the row's
    consumers (Excel's tzinfo-stripping cell writer, the PDF report) both format/strip
    directly from these values with no further conversion, so they must already be
    Manila-correct here rather than relying on whatever tzinfo Postgres happened to attach
    to a freshly-queried row (see blueprints/dilp.py's _interview_date_time_strings for the
    same class of bug this prevents)."""
    remarks_summary = " | ".join(r.remark for r in dilp_app.remarks) if dilp_app.remarks else None
    return {
        "reference_number": str(dilp_app.id),
        "jobseeker_name": dilp_app.jobseeker_profile.full_name if dilp_app.jobseeker_profile else None,
        "email": dilp_app.jobseeker_profile.user.email if dilp_app.jobseeker_profile and dilp_app.jobseeker_profile.user else None,
        "proposed_livelihood": dilp_app.proposed_livelihood,
        "capital_needed": float(dilp_app.capital_needed) if dilp_app.capital_needed is not None else None,
        "status": dilp_app.status,
        "created_at": _to_manila_or_none(dilp_app.created_at),
        "interview_at": _to_manila_or_none(dilp_app.interview_at),
        "completed_at": _to_manila_or_none(dilp_app.completed_at),
        "ready_for_claiming_at": _to_manila_or_none(dilp_app.ready_for_claiming_at),
        "approved_at": _to_manila_or_none(dilp_app.approved_at),
        "submitted_to_esfo_at": _to_manila_or_none(dilp_app.submitted_to_esfo_at),
        "no_show_count": dilp_app.no_show_count,
        "remarks": remarks_summary,
    }
