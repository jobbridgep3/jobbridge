from datetime import date

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.jobseeker import JobseekerProfile
from models.user import User
from services.notification_service import notify_role, notify_user
from utils.decorators import role_required
from utils.responses import fail, ok

employment_bp = Blueprint("employment", __name__, url_prefix="/api/employment")


def create_employment_record_for_application(application):
    """Called when an employer marks an applicant as Hired — auto-creates the employment record."""
    vacancy = application.vacancy
    record = EmploymentRecord(
        application_id=application.id,
        jobseeker_profile_id=application.jobseeker_profile_id,
        employer_company_id=vacancy.employer_company_id,
        position=vacancy.title,
        start_date=date.today(),
        status="active",
    )
    db.session.add(record)
    db.session.commit()

    jobseeker_user_id = application.jobseeker_profile.user_id
    notify_user(
        jobseeker_user_id, "employment_created", "You're Hired!",
        f"You have been marked as hired for {vacancy.title}.",
        link="/jobseeker/employment", socket_event="employment:updated",
        socket_payload=record.to_dict(),
    )
    notify_role("staff", "employment:updated", record.to_dict())
    return record


@employment_bp.get("/my")
@jwt_required()
@role_required("jobseeker")
def my_employment():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    records = EmploymentRecord.query.filter_by(jobseeker_profile_id=profile.id).order_by(EmploymentRecord.start_date.desc()).all()
    return ok([r.to_dict() for r in records])


@employment_bp.get("/my-hires")
@jwt_required()
@role_required("employer")
def my_hires():
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not company:
        return ok([])
    records = EmploymentRecord.query.filter_by(employer_company_id=company.id).order_by(EmploymentRecord.start_date.desc()).all()
    return ok([r.to_dict() for r in records])


@employment_bp.put("/<record_id>/status")
@jwt_required()
@role_required("employer")
def update_employment_status(record_id):
    record = EmploymentRecord.query.get(record_id)
    if not record:
        return fail("Employment record not found.", 404)
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in ("terminated", "completed", "active"):
        return fail("Invalid status.", 400)
    record.status = new_status
    if new_status == "terminated":
        record.termination_reason = data.get("termination_reason")
        record.end_date = date.today()
    elif new_status == "completed":
        record.end_date = date.today()
    db.session.commit()

    notify_user(
        record.jobseeker_profile.user_id, "employment_updated", "Employment status updated",
        f"Your employment status is now {new_status}.", link="/jobseeker/employment",
        socket_event="employment:updated", socket_payload=record.to_dict(),
    )
    notify_role("staff", "employment:updated", record.to_dict())
    return ok(record.to_dict(), "Employment status updated.")
