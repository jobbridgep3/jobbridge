"""KPI aggregation + analytics for the SPES module — same shape as
owwa_reporting_service.py/manpower_reporting_service.py: build_*_stats() for
dashboard/report summary cards, query_*_for_report()/*_report_row() for Excel/PDF
exports.
"""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.spes import SPES_APPLICATION_STATUSES, SpesApplication, SpesAttendanceLog, SpesBatch
from services.dashboard_service import _month_buckets
from utils.timezone import manila_day_bounds, to_manila

REPORT_ROW_LIMIT = 20000

# Statuses reached only after Staff approved the applicant for orientation (i.e. they
# were invited) — the denominator for "orientation invited"/orientation attendance rate.
ORIENTATION_INVITED_STATUSES = tuple(s for s in SPES_APPLICATION_STATUSES if s not in ("pending_review", "rejected"))
# Statuses reached only after the applicant PASSED orientation (i.e. they became
# exam-eligible) — cumulative, since an applicant who has since attended/passed/failed
# the exam no longer shows "orientation_passed" as their *current* status but did pass
# through it. failed_orientation applicants never reach this set.
ORIENTATION_PASSED_STATUSES = ("orientation_passed", "attended_exam", "passed", "failed")


def _spes_application_filters(query, batch_id=None, status=None, date_from=None, date_to=None, search=None):
    """Shared filter logic applied consistently to every SpesApplication-based query
    across stats/report/export, so on-screen numbers, tables, and exports can never
    diverge for the same set of active filters.

    date_from/date_to boundaries go through manila_day_bounds() rather than a raw
    date/string comparison against submitted_at (a DateTime(timezone=True) column) —
    comparing a bare date directly lets Postgres cast it using the DB session's timezone
    (UTC, since no session here pins Asia/Manila), silently shifting the intended Manila
    day boundary by 8 hours and excluding early-morning Manila submissions from a "today"
    filter. manila_day_bounds() works whether date_from/date_to arrive as 'YYYY-MM-DD'
    strings or date objects (str() of either interpolates the same way)."""
    if batch_id:
        query = query.filter(SpesApplication.batch_id == batch_id)
    if status:
        if status == "orientation_passed":
            # Cumulative, not exact-match: once an applicant passes orientation they
            # move on to attended_exam/passed/failed and no longer carry this literal
            # status, but they DID pass orientation — a "give me who passed
            # orientation" filter must still include them. Matches the cumulative
            # semantics _orientation_result_label() below already uses for display
            # labeling (identical status set, just never applied to filtering until
            # now). failed_orientation/passed/failed and every other status are
            # genuinely terminal or intentionally current-status-only, so they stay
            # an exact match.
            query = query.filter(SpesApplication.status.in_(ORIENTATION_PASSED_STATUSES))
        else:
            query = query.filter(SpesApplication.status == status)
    start, end = manila_day_bounds(date_from, date_to)
    if start:
        query = query.filter(SpesApplication.submitted_at >= start)
    if end:
        query = query.filter(SpesApplication.submitted_at < end)
    if search:
        query = query.filter(SpesApplication.full_name.ilike(f"%{search}%"))
    return query


def _spes_attendance_filter(attendance, application_scope=SpesApplication):
    """Returns a filter expression matching/excluding a SpesAttendanceLog row for the
    event type implied by `attendance` ('orientation_attended'/'orientation_absent'/
    'exam_attended'/'exam_absent'), or None if `attendance` isn't one of those."""
    if attendance not in ("orientation_attended", "orientation_absent", "exam_attended", "exam_absent"):
        return None
    event_type = "orientation" if attendance.startswith("orientation") else "exam"
    log_exists = SpesAttendanceLog.query.filter(
        SpesAttendanceLog.application_id == application_scope.id, SpesAttendanceLog.event_type == event_type,
    ).exists()
    return log_exists if attendance.endswith("attended") else ~log_exists


def build_spes_stats(batch_id=None, status=None, attendance=None, date_from=None, date_to=None, search=None) -> dict:
    query = _spes_application_filters(SpesApplication.query, batch_id, status, date_from, date_to, search)
    attendance_filter = _spes_attendance_filter(attendance)
    if attendance_filter is not None:
        query = query.filter(attendance_filter)

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

    attendance_query = _spes_application_filters(
        SpesAttendanceLog.query.join(SpesApplication), batch_id, status, date_from, date_to, search,
    )
    if attendance_filter is not None:
        attendance_query = attendance_query.filter(attendance_filter)
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
    query = SpesApplication.query.options(
        selectinload(SpesApplication.batch), selectinload(SpesApplication.attendance_logs),
        selectinload(SpesApplication.jobseeker_profile),
    )
    query = _spes_application_filters(query, batch_id, status, date_from, date_to, search)
    attendance_filter = _spes_attendance_filter(attendance)
    if attendance_filter is not None:
        query = query.filter(attendance_filter)
    return query.order_by(SpesApplication.submitted_at.desc()).limit(REPORT_ROW_LIMIT).all()


def spes_applicant_address(jobseeker_profile) -> str | None:
    """Same derivation JobseekerProfile.to_dict() uses (models/jobseeker.py) — prefer
    the structured barangay/municipality/province, fall back to the raw address field."""
    if not jobseeker_profile:
        return None
    return ", ".join(filter(None, [jobseeker_profile.barangay, jobseeker_profile.municipality, jobseeker_profile.province])) or jobseeker_profile.address


def _to_manila_or_none(dt):
    return to_manila(dt) if dt is not None else None


def _orientation_result_label(status: str) -> str:
    """"Passed" is cumulative (ORIENTATION_PASSED_STATUSES), not exact-match, mirroring
    the filter fix above — an applicant who has since progressed to the exam stage
    still passed orientation. Used by spes_report_row()'s consumers (e.g. the Outcomes
    export) so the label stays consistent wherever this row dict is used."""
    if status == "failed_orientation":
        return "Failed"
    if status in ORIENTATION_PASSED_STATUSES:
        return "Passed"
    return "Pending"


def _exam_result_label(status: str) -> str:
    if status == "passed":
        return "Passed"
    if status == "failed":
        return "Failed"
    return "Pending"


def spes_report_row(application: SpesApplication) -> dict:
    """Every datetime field is converted via to_manila() before being returned, so any
    downstream .strftime() call formats a Manila-correct value regardless of what tzinfo
    Postgres happened to attach to this freshly-queried row — see blueprints/dilp.py's
    _interview_date_time_strings for the same class of bug this prevents.

    Comprehensive — covers every applicant-facing field that actually exists in the
    system (application + jobseeker profile + batch schedule), for the Excel/PDF export's
    "complete applicant details" requirement. Nothing invented: fields with no data are
    simply None/False and rendered as an em dash by the export layer."""
    logged_events = {log.event_type for log in application.attendance_logs}
    profile = application.jobseeker_profile
    batch = application.batch
    return {
        "application_ref_no": application.application_ref_no,
        "jobseeker_name": application.full_name,
        "email": profile.user.email if profile and profile.user else None,
        "batch_name": batch.batch_name if batch else None,
        "status": application.status,
        "status_label": application.status.replace("_", " ").title(),
        "gwa": float(application.gwa) if application.gwa is not None else None,
        "family_income": float(application.family_income) if application.family_income is not None else None,
        "contact_number": profile.contact_number if profile else None,
        "date_of_birth": application.date_of_birth,
        "address": spes_applicant_address(profile),
        "submitted_at": _to_manila_or_none(application.submitted_at),
        "reviewed_at": _to_manila_or_none(application.reviewed_at),
        "orientation_at": _to_manila_or_none(batch.orientation_at) if batch else None,
        "orientation_attended": "orientation" in logged_events,
        "orientation_attendance_label": "Attended" if "orientation" in logged_events else "Absent",
        "orientation_outcome_at": _to_manila_or_none(application.orientation_outcome_at),
        "orientation_result_label": _orientation_result_label(application.status),
        "exam_at": _to_manila_or_none(batch.exam_at) if batch else None,
        "exam_attended": "exam" in logged_events,
        "exam_attendance_label": "Attended" if "exam" in logged_events else "Absent",
        "exam_result_at": _to_manila_or_none(application.exam_result_at),
        "exam_result_label": _exam_result_label(application.status),
        "peso_appointment_at": _to_manila_or_none(application.peso_appointment_at),
    }
