"""KPI aggregation + filtered report queries for ManPower Skills Management.

Stats are always global/unfiltered (the dashboard KPI cards), separate from the
filtered queries backing exports — mirrors dashboard_service.py's aggregate-count
style, not lmi.py's full-table-load-then-Python-count anti-pattern.
"""

from datetime import timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from extensions import db
from models.jobseeker import JobseekerProfile
from models.manpower_training import ManpowerTrainingApplication, ManpowerTrainingBatch

REPORT_ROW_LIMIT = 20000


def build_manpower_stats() -> dict:
    total_applications = ManpowerTrainingApplication.query.count()
    pending = ManpowerTrainingApplication.query.filter_by(status="pending").count()
    pooled = ManpowerTrainingApplication.query.filter_by(status="pooled").count()
    submitted_to_tesda = ManpowerTrainingApplication.query.filter_by(status="submitted_to_tesda").count()
    for_tesda_response = ManpowerTrainingApplication.query.filter_by(status="for_tesda_response").count()
    completed = ManpowerTrainingApplication.query.filter_by(status="completed").count()
    declined = ManpowerTrainingApplication.query.filter_by(status="declined").count()
    active_batches = ManpowerTrainingBatch.query.filter_by(status="forming").count()

    pooled_per_batch = dict(
        db.session.query(ManpowerTrainingApplication.batch_id, func.count(ManpowerTrainingApplication.id))
        .filter(ManpowerTrainingApplication.batch_id.isnot(None), ManpowerTrainingApplication.status != "declined")
        .group_by(ManpowerTrainingApplication.batch_id)
        .all()
    )
    capped_batches = (
        ManpowerTrainingBatch.query.filter(ManpowerTrainingBatch.max_pax.isnot(None))
        .with_entities(ManpowerTrainingBatch.id, ManpowerTrainingBatch.max_pax)
        .all()
    )
    full_batches = 0
    available_slots = 0
    for batch_id, max_pax in capped_batches:
        remaining = max(max_pax - pooled_per_batch.get(batch_id, 0), 0)
        if remaining <= 0:
            full_batches += 1
        else:
            available_slots += remaining

    return {
        "total_applications": total_applications,
        "pending": pending,
        "pooled": pooled,
        "submitted_to_tesda": submitted_to_tesda,
        "for_tesda_response": for_tesda_response,
        "completed": completed,
        "declined": declined,
        "active_batches": active_batches,
        "full_batches": full_batches,
        "available_slots": available_slots,
    }


def query_applications_for_report(status=None, batch_id=None, date_from=None, date_to=None):
    query = ManpowerTrainingApplication.query.options(
        selectinload(ManpowerTrainingApplication.jobseeker_profile).selectinload(JobseekerProfile.user),
        selectinload(ManpowerTrainingApplication.batch),
    )
    if status:
        query = query.filter_by(status=status)
    if batch_id:
        query = query.filter_by(batch_id=batch_id)

    date_col = func.coalesce(ManpowerTrainingApplication.application_date, ManpowerTrainingApplication.created_at)
    if date_from:
        query = query.filter(date_col >= date_from)
    if date_to:
        query = query.filter(date_col < date_to + timedelta(days=1))

    return query.order_by(ManpowerTrainingApplication.created_at.desc()).limit(REPORT_ROW_LIMIT).all()


def query_batches_for_report(batch_status=None):
    query = ManpowerTrainingBatch.query.options(selectinload(ManpowerTrainingBatch.applications))
    if batch_status:
        query = query.filter_by(status=batch_status)
    return query.order_by(ManpowerTrainingBatch.created_at.desc()).limit(REPORT_ROW_LIMIT).all()


def application_report_row(application) -> dict:
    """One shared row shape consumed by both the Excel and PDF export routes, so the
    two formats can never disagree on what an application row contains."""
    return {
        "jobseeker_name": application.jobseeker_profile.full_name if application.jobseeker_profile else None,
        "email": application.jobseeker_profile.user.email if application.jobseeker_profile and application.jobseeker_profile.user else None,
        "program_interest": application.program_interest,
        "batch_name": application.batch.batch_name if application.batch else None,
        "status": application.status,
        "application_date": application.application_date or application.created_at,
        "remarks": application.remarks,
    }


def batch_report_row(batch) -> dict:
    pooled_count = len([a for a in batch.applications if a.status != "declined"])
    slots_remaining = max(batch.max_pax - pooled_count, 0) if batch.max_pax is not None else None
    return {
        "batch_name": batch.batch_name,
        "status": batch.status,
        "min_pax": batch.min_pax,
        "max_pax": batch.max_pax,
        "current_pax": pooled_count,
        "slots_remaining": slots_remaining,
        "submitted_to_tesda_date": batch.submitted_to_tesda_date,
        "tesda_response_date": batch.tesda_response_date,
    }
