"""KPI aggregation + analytics for the OWWA Assistance Program module — mirrors
dashboard_service.py's efficient grouped-query style (not lmi.py's full-table-load
anti-pattern) and manpower_reporting_service.py's shape for this codebase's other
recently-built reporting surfaces.
"""

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.jobseeker import JobseekerProfile
from models.owwa import OWWA_REQUEST_STATUSES, OwwaRequest, OwwaRequestRemark
from services.dashboard_service import _month_buckets

IN_PROGRESS_STATUSES = ("verified", "submitted_to_owwa", "for_owwa_response")
REPORT_ROW_LIMIT = 20000


def build_owwa_stats() -> dict:
    status_counts = dict(db.session.query(OwwaRequest.status, func.count(OwwaRequest.id)).group_by(OwwaRequest.status).all())
    for s in OWWA_REQUEST_STATUSES:
        status_counts.setdefault(s, 0)

    resolved = (
        db.session.query(OwwaRequest.submitted_at, OwwaRequest.completed_at, OwwaRequest.declined_at)
        .filter(OwwaRequest.status.in_(("completed", "declined")))
        .all()
    )
    day_spans = [
        ((row.completed_at or row.declined_at).date() - row.submitted_at.date()).days
        for row in resolved
        if row.submitted_at and (row.completed_at or row.declined_at)
    ]
    avg_processing_days = round(sum(day_spans) / len(day_spans), 1) if day_spans else None

    return {
        "total_requests": sum(status_counts.values()),
        "pending": status_counts["pending"],
        "verified": status_counts["verified"],
        "submitted_to_owwa": status_counts["submitted_to_owwa"],
        "for_owwa_response": status_counts["for_owwa_response"],
        "in_progress": sum(status_counts[s] for s in IN_PROGRESS_STATUSES),
        "completed": status_counts["completed"],
        "declined": status_counts["declined"],
        "avg_processing_days": avg_processing_days,
    }


def build_owwa_analytics(months: int = 6) -> dict:
    buckets = _month_buckets(min(max(months, 1), 12))
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]
    start_date = date(buckets[0][0], buckets[0][1], 1)

    month_rows = dict(
        db.session.query(func.to_char(OwwaRequest.created_at, "YYYY-MM"), func.count(OwwaRequest.id))
        .filter(OwwaRequest.created_at >= start_date)
        .group_by(func.to_char(OwwaRequest.created_at, "YYYY-MM"))
        .all()
    )
    requests_per_month = [{"month": lbl, "count": month_rows.get(lbl, 0)} for lbl in labels]

    status_counts = dict(db.session.query(OwwaRequest.status, func.count(OwwaRequest.id)).group_by(OwwaRequest.status).all())
    status_distribution = [
        {"label": s.replace("_", " ").title(), "count": status_counts.get(s, 0)} for s in OWWA_REQUEST_STATUSES
    ]

    return {"requests_per_month": requests_per_month, "status_distribution": status_distribution}


def query_owwa_requests_for_report(status=None, date_from=None, date_to=None, search=None):
    query = OwwaRequest.query.options(
        selectinload(OwwaRequest.jobseeker_profile).selectinload(JobseekerProfile.user),
        selectinload(OwwaRequest.remarks).selectinload(OwwaRequestRemark.staff),
    )
    if status:
        query = query.filter(OwwaRequest.status == status)
    if date_from:
        query = query.filter(OwwaRequest.submitted_at >= date_from)
    if date_to:
        query = query.filter(OwwaRequest.submitted_at < date_to + timedelta(days=1))
    if search:
        query = query.join(JobseekerProfile).filter(JobseekerProfile.full_name.ilike(f"%{search}%"))
    return query.order_by(OwwaRequest.submitted_at.desc()).limit(REPORT_ROW_LIMIT).all()


def owwa_report_row(owwa_request) -> dict:
    remarks_summary = " | ".join(r.remark for r in owwa_request.remarks) if owwa_request.remarks else None
    return {
        "reference_number": str(owwa_request.id),
        "jobseeker_name": owwa_request.jobseeker_profile.full_name if owwa_request.jobseeker_profile else None,
        "email": owwa_request.jobseeker_profile.user.email if owwa_request.jobseeker_profile and owwa_request.jobseeker_profile.user else None,
        "ofw_relationship": owwa_request.ofw_relationship,
        "status": owwa_request.status,
        "submitted_at": owwa_request.submitted_at,
        "verified_at": owwa_request.verified_at,
        "submitted_to_owwa_at": owwa_request.submitted_to_owwa_at,
        "for_owwa_response_at": owwa_request.for_owwa_response_at,
        "completed_at": owwa_request.completed_at,
        "appointment_at": owwa_request.appointment_at,
        "declined_reason": owwa_request.declined_reason,
        "remarks": remarks_summary,
    }
