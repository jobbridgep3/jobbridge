"""KPI aggregation + analytics for the SPES module — same shape as
owwa_reporting_service.py/manpower_reporting_service.py: build_*_stats() for
dashboard/report summary cards, query_*_for_report()/*_report_row() for Excel/PDF
exports.
"""

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.spes import SPES_APPLICATION_STATUSES, SpesApplication, SpesAttendanceLog, SpesBatch
from services.dashboard_service import _month_buckets

REPORT_ROW_LIMIT = 20000

# Statuses reached only after Staff approved the applicant for orientation (i.e. they
# were invited) — the denominator for "orientation invited"/orientation attendance rate.
ORIENTATION_INVITED_STATUSES = tuple(s for s in SPES_APPLICATION_STATUSES if s not in ("pending_review", "rejected"))
# Statuses reached only after the applicant PASSED orientation (i.e. they became
# exam-eligible) — cumulative, since an applicant who has since attended/passed/failed
# the exam no longer shows "orientation_passed" as their *current* status but did pass
# through it. failed_orientation applicants never reach this set.
ORIENTATION_PASSED_STATUSES = ("orientation_passed", "attended_exam", "passed", "failed")


def build_spes_stats(batch_id=None) -> dict:
    query = SpesApplication.query
    if batch_id:
        query = query.filter(SpesApplication.batch_id == batch_id)

    status_counts = dict(query.with_entities(SpesApplication.status, func.count(SpesApplication.id)).group_by(SpesApplication.status).all())
    for s in SPES_APPLICATION_STATUSES:
        status_counts.setdefault(s, 0)
    total_applicants = sum(status_counts.values())

    orientation_invited = sum(status_counts[s] for s in ORIENTATION_INVITED_STATUSES)
    orientation_passed_count = sum(status_counts[s] for s in ORIENTATION_PASSED_STATUSES)
    orientation_failed_count = status_counts["failed_orientation"]
    exam_eligible = orientation_passed_count
    exam_passed_count = status_counts["passed"]
    exam_failed_count = status_counts["failed"]

    attendance_query = SpesAttendanceLog.query.join(SpesApplication)
    if batch_id:
        attendance_query = attendance_query.filter(SpesApplication.batch_id == batch_id)
    orientation_attended = attendance_query.filter(SpesAttendanceLog.event_type == "orientation").count()
    exam_attended = attendance_query.filter(SpesAttendanceLog.event_type == "exam").count()
    orientation_absent = max(orientation_invited - orientation_attended, 0)
    exam_absent = max(exam_eligible - exam_attended, 0)

    resolved_exam_count = exam_passed_count + exam_failed_count

    if batch_id:
        allocation = db.session.query(SpesBatch.budget_allocation).filter(SpesBatch.id == batch_id).scalar()
    else:
        allocation = db.session.query(func.coalesce(func.sum(SpesBatch.budget_allocation), 0)).scalar()
    allocation = float(allocation) if allocation is not None else None

    return {
        "total_applicants": total_applicants,
        "pending_review": status_counts["pending_review"],
        "rejected": status_counts["rejected"],
        "approved_for_orientation": status_counts["approved_for_orientation"],
        # currently_orientation_passed: LIVE count of applicants whose status is right
        # now 'orientation_passed' (i.e. genuinely still waiting to take the exam) —
        # for dashboard "needs action" tiles. orientation_passed below is the
        # CUMULATIVE count (orientation_passed OR anyone who progressed further) used
        # for report/funnel totals, matching how orientation_invited/exam_eligible are
        # already cumulative elsewhere in this function.
        "currently_orientation_passed": status_counts["orientation_passed"],
        "orientation_attended": orientation_attended,
        "orientation_absent": orientation_absent,
        "orientation_passed": orientation_passed_count,
        "orientation_failed": orientation_failed_count,
        "exam_attended": exam_attended,
        "exam_absent": exam_absent,
        "exam_passed": exam_passed_count,
        "exam_failed": exam_failed_count,
        "orientation_attendance_rate": round(orientation_attended / orientation_invited * 100, 1) if orientation_invited else None,
        "exam_attendance_rate": round(exam_attended / exam_eligible * 100, 1) if exam_eligible else None,
        "pass_rate": round(exam_passed_count / resolved_exam_count * 100, 1) if resolved_exam_count else None,
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


def query_spes_applications_for_report(batch_id=None, status=None, attendance=None, date_from=None, date_to=None, search=None):
    """attendance: one of 'orientation_attended'/'orientation_absent'/'exam_attended'/
    'exam_absent', filtering by presence/absence of a SpesAttendanceLog row for the
    matching event_type (independent of the applicant's current status)."""
    query = SpesApplication.query.options(selectinload(SpesApplication.batch), selectinload(SpesApplication.attendance_logs))
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
    if attendance in ("orientation_attended", "orientation_absent", "exam_attended", "exam_absent"):
        event_type = "orientation" if attendance.startswith("orientation") else "exam"
        log_exists = SpesAttendanceLog.query.filter(
            SpesAttendanceLog.application_id == SpesApplication.id, SpesAttendanceLog.event_type == event_type,
        ).exists()
        query = query.filter(log_exists if attendance.endswith("attended") else ~log_exists)
    return query.order_by(SpesApplication.submitted_at.desc()).limit(REPORT_ROW_LIMIT).all()


def spes_report_row(application: SpesApplication) -> dict:
    logged_events = {log.event_type for log in application.attendance_logs}
    return {
        "application_ref_no": application.application_ref_no,
        "jobseeker_name": application.full_name,
        "batch_name": application.batch.batch_name if application.batch else None,
        "status": application.status,
        "gwa": float(application.gwa) if application.gwa is not None else None,
        "family_income": float(application.family_income) if application.family_income is not None else None,
        "submitted_at": application.submitted_at,
        "reviewed_at": application.reviewed_at,
        "orientation_attended": "orientation" in logged_events,
        "orientation_outcome_at": application.orientation_outcome_at,
        "exam_attended": "exam" in logged_events,
        "exam_result_at": application.exam_result_at,
    }
