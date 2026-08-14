"""KPI aggregation + analytics for the SPES module — same shape as
owwa_reporting_service.py/manpower_reporting_service.py: build_*_stats() for
dashboard/report summary cards, query_*_for_report()/*_report_row() for Excel/PDF
exports.
"""

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.spes import SPES_APPLICATION_STATUSES, SpesApplication, SpesAttendanceLog, SpesBatch, SpesDtrEntry
from services.dashboard_service import _month_buckets

REPORT_ROW_LIMIT = 20000

# Statuses reached only after Staff approved the applicant for orientation (i.e. they
# were invited) — the denominator for orientation attendance rate.
ORIENTATION_INVITED_STATUSES = tuple(s for s in SPES_APPLICATION_STATUSES if s not in ("pending_review", "rejected"))
# Statuses reached only after the applicant attended orientation (i.e. they were
# exam-eligible) — the denominator for exam attendance rate. failed_orientation
# applicants never become exam-eligible.
EXAM_ELIGIBLE_STATUSES = tuple(
    s for s in SPES_APPLICATION_STATUSES if s not in ("pending_review", "rejected", "approved_for_orientation", "failed_orientation")
)
PASSED_OR_BEYOND_STATUSES = ("passed", "for_deployment", "deployed", "completed", "terminated")


def build_spes_stats(batch_id=None) -> dict:
    query = SpesApplication.query
    if batch_id:
        query = query.filter(SpesApplication.batch_id == batch_id)

    status_counts = dict(query.with_entities(SpesApplication.status, func.count(SpesApplication.id)).group_by(SpesApplication.status).all())
    for s in SPES_APPLICATION_STATUSES:
        status_counts.setdefault(s, 0)
    total_applications = sum(status_counts.values())

    invited_count = sum(status_counts[s] for s in ORIENTATION_INVITED_STATUSES)
    exam_eligible_count = sum(status_counts[s] for s in EXAM_ELIGIBLE_STATUSES)
    passed_count = sum(status_counts[s] for s in PASSED_OR_BEYOND_STATUSES)
    resolved_exam_count = passed_count + status_counts["failed"]

    attendance_query = SpesAttendanceLog.query.join(SpesApplication)
    if batch_id:
        attendance_query = attendance_query.filter(SpesApplication.batch_id == batch_id)
    orientation_attended = attendance_query.filter(SpesAttendanceLog.event_type == "orientation").count()
    exam_attended = attendance_query.filter(SpesAttendanceLog.event_type == "exam").count()

    dtr_query = SpesDtrEntry.query.join(SpesDtrEntry.deployment).join(SpesApplication)
    if batch_id:
        dtr_query = dtr_query.filter(SpesApplication.batch_id == batch_id)
    total_dtr = dtr_query.count()
    approved_dtr = dtr_query.filter(SpesDtrEntry.status == "approved").count()

    if batch_id:
        allocation = db.session.query(SpesBatch.budget_allocation).filter(SpesBatch.id == batch_id).scalar()
    else:
        allocation = db.session.query(func.coalesce(func.sum(SpesBatch.budget_allocation), 0)).scalar()
    allocation = float(allocation) if allocation is not None else None

    return {
        "total_applications": total_applications,
        "pending_review": status_counts["pending_review"],
        "approved_for_orientation": status_counts["approved_for_orientation"],
        "attended_orientation": status_counts["attended_orientation"],
        "failed_orientation": status_counts["failed_orientation"],
        "passed": status_counts["passed"],
        "failed": status_counts["failed"],
        "for_deployment": status_counts["for_deployment"],
        "deployed": status_counts["deployed"],
        "completed": status_counts["completed"],
        "terminated": status_counts["terminated"],
        "rejected": status_counts["rejected"],
        "orientation_attendance_rate": round(orientation_attended / invited_count * 100, 1) if invited_count else None,
        "exam_attendance_rate": round(exam_attended / exam_eligible_count * 100, 1) if exam_eligible_count else None,
        "pass_rate": round(passed_count / resolved_exam_count * 100, 1) if resolved_exam_count else None,
        "dtr_compliance_rate": round(approved_dtr / total_dtr * 100, 1) if total_dtr else None,
        "budget_allocation": allocation,
        "wage_subsidy_employer_share": round(allocation * 0.6, 2) if allocation is not None else None,
        "wage_subsidy_dole_share": round(allocation * 0.4, 2) if allocation is not None else None,
    }


def build_spes_analytics(months: int = 6) -> dict:
    buckets = _month_buckets(min(max(months, 1), 12))
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]
    start_date = date(buckets[0][0], buckets[0][1], 1)

    month_rows = dict(
        db.session.query(func.to_char(SpesApplication.created_at, "YYYY-MM"), func.count(SpesApplication.id))
        .filter(SpesApplication.created_at >= start_date)
        .group_by(func.to_char(SpesApplication.created_at, "YYYY-MM"))
        .all()
    )
    applications_per_month = [{"month": lbl, "count": month_rows.get(lbl, 0)} for lbl in labels]

    status_counts = dict(db.session.query(SpesApplication.status, func.count(SpesApplication.id)).group_by(SpesApplication.status).all())
    status_distribution = [
        {"label": s.replace("_", " ").title(), "count": status_counts.get(s, 0)} for s in SPES_APPLICATION_STATUSES
    ]

    return {"applications_per_month": applications_per_month, "status_distribution": status_distribution}


def query_spes_applications_for_report(batch_id=None, status=None, date_from=None, date_to=None, search=None):
    query = SpesApplication.query.options(selectinload(SpesApplication.batch))
    if batch_id:
        query = query.filter(SpesApplication.batch_id == batch_id)
    if status:
        query = query.filter(SpesApplication.status == status)
    if date_from:
        query = query.filter(SpesApplication.submitted_at >= date_from)
    if date_to:
        query = query.filter(SpesApplication.submitted_at < date_to + timedelta(days=1))
    if search:
        query = query.filter(SpesApplication.full_name.ilike(f"%{search}%"))
    return query.order_by(SpesApplication.submitted_at.desc()).limit(REPORT_ROW_LIMIT).all()


def spes_report_row(application: SpesApplication) -> dict:
    return {
        "application_ref_no": application.application_ref_no,
        "jobseeker_name": application.full_name,
        "batch_name": application.batch.batch_name if application.batch else None,
        "status": application.status,
        "gwa": float(application.gwa) if application.gwa is not None else None,
        "family_income": float(application.family_income) if application.family_income is not None else None,
        "submitted_at": application.submitted_at,
        "reviewed_at": application.reviewed_at,
        "orientation_outcome_at": application.orientation_outcome_at,
        "exam_result_at": application.exam_result_at,
    }
