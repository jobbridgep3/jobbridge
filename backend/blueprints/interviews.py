from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.email_service import send_interview_invite_email
from services.notification_service import notify_user
from utils.decorators import role_required
from utils.responses import fail, ok

interviews_bp = Blueprint("interviews", __name__, url_prefix="/api/interviews")


@interviews_bp.get("/my")
@jwt_required()
def my_interviews():
    role = get_jwt().get("role")
    if role == "jobseeker":
        profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
        if not profile:
            return ok([])
        interviews = (
            Interview.query.join(Application).filter(Application.jobseeker_profile_id == profile.id)
            .order_by(Interview.scheduled_date.desc()).all()
        )
    elif role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        if not company:
            return ok([])
        interviews = (
            Interview.query.join(Application).join(Vacancy)
            .filter(Vacancy.employer_company_id == company.id)
            .order_by(Interview.scheduled_date.desc()).all()
        )
    else:
        return fail("Not supported for this role.", 403)
    return ok([i.to_dict() for i in interviews])


@interviews_bp.get("/upcoming")
@jwt_required()
def upcoming_interviews():
    role = get_jwt().get("role")
    now = datetime.utcnow()
    if role == "jobseeker":
        profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
        if not profile:
            return ok([])
        interviews = (
            Interview.query.join(Application).filter(
                Application.jobseeker_profile_id == profile.id, Interview.scheduled_date >= now
            ).order_by(Interview.scheduled_date.asc()).limit(3).all()
        )
    elif role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        if not company:
            return ok([])
        interviews = (
            Interview.query.join(Application).join(Vacancy).filter(
                Vacancy.employer_company_id == company.id, Interview.scheduled_date >= now
            ).order_by(Interview.scheduled_date.asc()).limit(7).all()
        )
    else:
        return ok([])
    return ok([i.to_dict() for i in interviews])


@interviews_bp.post("")
@jwt_required()
@role_required("employer")
def create_interview():
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    data = request.get_json(force=True) or {}
    application = Application.query.get(data.get("application_id"))
    if not application or not company or application.vacancy.employer_company_id != company.id:
        return fail("Applicant not found.", 404)

    interview = Interview(
        application_id=application.id,
        scheduled_date=datetime.fromisoformat(data["scheduled_date"]),
        mode=data.get("mode", "onsite"),
        location=data.get("location", ""),
        status="pending",
    )
    application.status = "interview_scheduled"
    db.session.add(interview)
    db.session.commit()

    jobseeker = application.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker.user_id)
    notify_user(
        jobseeker.user_id, "interview_scheduled", "Interview Invitation",
        f"{company.company_name} invited you to an interview for {application.vacancy.title}.",
        link="/jobseeker/interviews", socket_event="interview:scheduled",
        socket_payload=interview.to_dict(),
    )
    send_interview_invite_email(
        jobseeker_user.email, application.vacancy.title, company.company_name,
        interview.scheduled_date.strftime("%B %d, %Y %I:%M %p"), interview.mode, interview.location,
    )
    log_audit(User.query.get(company.user_id), "Create", "interviews", interview.id)

    return ok(interview.to_dict(), "Interview scheduled.", 201)


@interviews_bp.put("/<interview_id>")
@jwt_required()
@role_required("employer")
def update_interview(interview_id):
    interview = Interview.query.get(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    data = request.get_json(force=True) or {}
    if data.get("scheduled_date"):
        interview.scheduled_date = datetime.fromisoformat(data["scheduled_date"])
    for field in ("mode", "location", "notes"):
        if field in data:
            setattr(interview, field, data[field])
    if data.get("reschedule"):
        interview.status = "pending"
    db.session.commit()
    return ok(interview.to_dict(), "Interview updated.")


@interviews_bp.put("/<interview_id>/accept")
@jwt_required()
@role_required("jobseeker")
def accept_interview(interview_id):
    interview = Interview.query.get(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    interview.status = "accepted"
    db.session.commit()

    employer_user_id = interview.application.vacancy.employer_company.user_id
    notify_user(
        employer_user_id, "interview_accepted", "Interview Accepted",
        f"{interview.application.jobseeker_profile.full_name} accepted the interview invitation.",
        link="/employer/interviews", socket_event="interview:accepted",
        socket_payload={"interview_id": str(interview.id)},
    )
    return ok(interview.to_dict(), "Interview accepted.")


@interviews_bp.put("/<interview_id>/decline")
@jwt_required()
@role_required("jobseeker")
def decline_interview(interview_id):
    interview = Interview.query.get(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    data = request.get_json(force=True) or {}
    interview.status = "declined"
    interview.decline_reason = data.get("reason")
    db.session.commit()

    employer_user_id = interview.application.vacancy.employer_company.user_id
    notify_user(
        employer_user_id, "interview_declined", "Interview Declined",
        f"{interview.application.jobseeker_profile.full_name} declined the interview invitation.",
        link="/employer/interviews", socket_event="interview:declined",
        socket_payload={"interview_id": str(interview.id), "reason": interview.decline_reason},
    )
    return ok(interview.to_dict(), "Interview declined.")


@interviews_bp.put("/<interview_id>/complete")
@jwt_required()
@role_required("employer")
def complete_interview(interview_id):
    interview = Interview.query.get(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    data = request.get_json(force=True) or {}
    interview.status = "completed"
    if "notes" in data:
        interview.notes = data["notes"]
    db.session.commit()
    return ok(interview.to_dict(), "Interview marked as completed.")
