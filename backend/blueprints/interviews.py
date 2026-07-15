from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.interview import INTERVIEW_RESULTS, Interview, InterviewRescheduleRequest
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.application_status_service import transition_application
from services.audit_service import log_audit
from services.email_service import (
    send_interview_cancelled_email,
    send_interview_invite_email,
    send_interview_rescheduled_email,
    send_interview_result_email,
    send_reschedule_request_email,
    send_reschedule_response_email,
)
from services.notification_service import notify_user
from services.pdf_service import generate_interview_invitation, to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

interviews_bp = Blueprint("interviews", __name__, url_prefix="/api/interviews")

RESULT_LABELS = {"pending": "Pending", "passed": "Passed", "failed": "Failed", "shortlisted": "Shortlisted", "hired": "Hired"}


def _company():
    return EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()


def _jobseeker():
    return JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()


def _employer_interview(interview_id):
    """Interview owned by the requesting employer, or None."""
    company = _company()
    interview = Interview.query.get(interview_id)
    if not interview or not company or interview.application.vacancy.employer_company_id != company.id:
        return None, None
    return interview, company


def _jobseeker_interview(interview_id):
    profile = _jobseeker()
    interview = Interview.query.get(interview_id)
    if not interview or not profile or interview.application.jobseeker_profile_id != profile.id:
        return None, None
    return interview, profile


def _when_str(dt):
    return dt.strftime("%B %d, %Y %I:%M %p") if dt else ""


@interviews_bp.get("/my")
@jwt_required()
def my_interviews():
    role = get_jwt().get("role")
    if role == "jobseeker":
        profile = _jobseeker()
        if not profile:
            return ok([])
        interviews = (
            Interview.query.join(Application).filter(Application.jobseeker_profile_id == profile.id)
            .order_by(Interview.scheduled_date.desc()).all()
        )
        return ok([i.to_dict(include_notes=False) for i in interviews])
    elif role == "employer":
        company = _company()
        if not company:
            return ok([])
        interviews = (
            Interview.query.join(Application).join(Vacancy)
            .filter(Vacancy.employer_company_id == company.id)
            .order_by(Interview.scheduled_date.desc()).all()
        )
        return ok([i.to_dict() for i in interviews])
    return fail("Not supported for this role.", 403)


@interviews_bp.get("/upcoming")
@jwt_required()
def upcoming_interviews():
    role = get_jwt().get("role")
    now = datetime.utcnow()
    if role == "jobseeker":
        profile = _jobseeker()
        if not profile:
            return ok([])
        interviews = (
            Interview.query.join(Application).filter(
                Application.jobseeker_profile_id == profile.id, Interview.scheduled_date >= now
            ).order_by(Interview.scheduled_date.asc()).limit(3).all()
        )
        return ok([i.to_dict(include_notes=False) for i in interviews])
    elif role == "employer":
        company = _company()
        if not company:
            return ok([])
        interviews = (
            Interview.query.join(Application).join(Vacancy).filter(
                Vacancy.employer_company_id == company.id, Interview.scheduled_date >= now
            ).order_by(Interview.scheduled_date.asc()).limit(7).all()
        )
        return ok([i.to_dict() for i in interviews])
    return ok([])


@interviews_bp.get("/calendar")
@jwt_required()
def calendar_interviews():
    """Role-scoped interviews within a [from, to] range, for the calendar views."""
    role = get_jwt().get("role")
    try:
        date_from = datetime.fromisoformat(request.args["from"])
        date_to = datetime.fromisoformat(request.args["to"])
    except (KeyError, ValueError):
        return fail("Provide 'from' and 'to' ISO dates.", 400)

    query = Interview.query.join(Application).filter(
        Interview.scheduled_date >= date_from, Interview.scheduled_date <= date_to
    )
    if role == "jobseeker":
        profile = _jobseeker()
        if not profile:
            return ok([])
        interviews = query.filter(Application.jobseeker_profile_id == profile.id).order_by(Interview.scheduled_date.asc()).all()
        return ok([i.to_dict(include_notes=False) for i in interviews])
    elif role == "employer":
        company = _company()
        if not company:
            return ok([])
        interviews = (
            query.join(Vacancy).filter(Vacancy.employer_company_id == company.id)
            .order_by(Interview.scheduled_date.asc()).all()
        )
        return ok([i.to_dict() for i in interviews])
    elif role in ("staff", "admin"):
        interviews = query.order_by(Interview.scheduled_date.asc()).all()
        return ok([i.to_dict() for i in interviews])
    return ok([])


@interviews_bp.post("")
@jwt_required()
@role_required("employer")
def create_interview():
    company = _company()
    data = request.get_json(force=True) or {}
    application = Application.query.get(data.get("application_id"))
    if not application or not company or application.vacancy.employer_company_id != company.id:
        return fail("Applicant not found.", 404)

    try:
        scheduled_date = datetime.fromisoformat(data["scheduled_date"])
    except (KeyError, ValueError):
        return fail("A valid interview date is required.", 400)

    interview = Interview(
        application_id=application.id,
        scheduled_date=scheduled_date,
        mode=data.get("mode", "onsite"),
        location=data.get("location", ""),
        meeting_link=data.get("meeting_link"),
        interviewer_name=data.get("interviewer_name"),
        status="pending",
    )
    db.session.add(interview)

    actor = User.query.get(company.user_id)
    if application.status != "interview_scheduled":
        # notify=False: the richer interview-invite notification + email below covers it.
        success, error = transition_application(application, "interview_scheduled", actor, notify=False)
        if not success:
            db.session.rollback()
            return fail(error, 400)
    db.session.commit()

    jobseeker = application.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker.user_id)
    notify_user(
        jobseeker.user_id, "interview_scheduled", "Interview Invitation",
        f"{company.company_name} invited you to an interview for {application.vacancy.title}.",
        link="/jobseeker/interviews", socket_event="interview:scheduled",
        socket_payload=interview.to_dict(include_notes=False),
    )
    send_interview_invite_email(
        jobseeker_user.email, application.vacancy.title, company.company_name,
        _when_str(interview.scheduled_date), interview.mode, interview.meeting_link or interview.location,
    )
    log_audit(actor, "Create", "interviews", interview.id)

    return ok(interview.to_dict(), "Interview scheduled.", 201)


@interviews_bp.put("/<interview_id>")
@jwt_required()
@role_required("employer")
def update_interview(interview_id):
    interview, company = _employer_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    if interview.status in ("cancelled", "completed"):
        return fail("A cancelled or completed interview can no longer be edited.", 400)

    data = request.get_json(force=True) or {}
    date_changed = False
    if data.get("scheduled_date"):
        try:
            new_date = datetime.fromisoformat(data["scheduled_date"])
        except ValueError:
            return fail("Invalid date.", 400)
        date_changed = new_date != interview.scheduled_date
        interview.scheduled_date = new_date
    for field in ("mode", "location", "notes", "meeting_link", "interviewer_name"):
        if field in data:
            setattr(interview, field, data[field])
    if data.get("reschedule") or date_changed:
        interview.status = "pending"  # jobseeker must re-confirm the new schedule
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "interviews", interview.id)

    if date_changed:
        jobseeker = interview.application.jobseeker_profile
        jobseeker_user = User.query.get(jobseeker.user_id)
        notify_user(
            jobseeker.user_id, "interview_rescheduled", "Interview Rescheduled",
            f"Your interview for {interview.application.vacancy.title} was moved to {_when_str(interview.scheduled_date)}.",
            link="/jobseeker/interviews", socket_event="interview:rescheduled",
            socket_payload=interview.to_dict(include_notes=False),
        )
        send_interview_rescheduled_email(
            jobseeker_user.email, interview.application.vacancy.title, company.company_name,
            _when_str(interview.scheduled_date), interview.mode, interview.meeting_link or interview.location,
        )
    return ok(interview.to_dict(), "Interview updated.")


@interviews_bp.put("/<interview_id>/cancel")
@jwt_required()
@role_required("employer")
def cancel_interview(interview_id):
    interview, company = _employer_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    if interview.status in ("cancelled", "completed"):
        return fail("This interview is already closed.", 400)

    data = request.get_json(force=True) or {}
    interview.status = "cancelled"
    if data.get("reason"):
        interview.notes = ((interview.notes or "") + f"\nCancelled: {data['reason']}").strip()
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "interviews", interview.id, "Cancelled")

    jobseeker = interview.application.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker.user_id)
    notify_user(
        jobseeker.user_id, "interview_cancelled", "Interview Cancelled",
        f"{company.company_name} cancelled the interview for {interview.application.vacancy.title}.",
        link="/jobseeker/interviews", socket_event="interview:cancelled",
        socket_payload={"interview_id": str(interview.id)},
    )
    send_interview_cancelled_email(
        jobseeker_user.email, interview.application.vacancy.title, company.company_name, data.get("reason"),
    )
    return ok(interview.to_dict(), "Interview cancelled.")


@interviews_bp.put("/<interview_id>/accept")
@jwt_required()
@role_required("jobseeker")
def accept_interview(interview_id):
    interview, profile = _jobseeker_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    if interview.status not in ("pending", "rescheduled"):
        return fail("This interview can no longer be accepted.", 400)
    interview.status = "accepted"
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "interviews", interview.id, "Accepted by jobseeker")

    employer_user_id = interview.application.vacancy.employer_company.user_id
    notify_user(
        employer_user_id, "interview_accepted", "Interview Accepted",
        f"{profile.full_name} accepted the interview invitation.",
        link="/employer/interviews", socket_event="interview:accepted",
        socket_payload={"interview_id": str(interview.id)},
    )
    return ok(interview.to_dict(include_notes=False), "Interview accepted.")


@interviews_bp.put("/<interview_id>/decline")
@jwt_required()
@role_required("jobseeker")
def decline_interview(interview_id):
    interview, profile = _jobseeker_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    if interview.status not in ("pending", "rescheduled", "accepted"):
        return fail("This interview can no longer be declined.", 400)
    data = request.get_json(force=True) or {}
    interview.status = "declined"
    interview.decline_reason = data.get("reason")
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "interviews", interview.id, "Declined by jobseeker")

    employer_user_id = interview.application.vacancy.employer_company.user_id
    notify_user(
        employer_user_id, "interview_declined", "Interview Declined",
        f"{profile.full_name} declined the interview invitation.",
        link="/employer/interviews", socket_event="interview:declined",
        socket_payload={"interview_id": str(interview.id), "reason": interview.decline_reason},
    )
    return ok(interview.to_dict(include_notes=False), "Interview declined.")


@interviews_bp.put("/<interview_id>/complete")
@jwt_required()
@role_required("employer")
def complete_interview(interview_id):
    interview, company = _employer_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    data = request.get_json(force=True) or {}
    interview.status = "completed"
    if "notes" in data:
        interview.notes = data["notes"]
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "interviews", interview.id, "Marked completed")

    application = interview.application
    if application.status == "interview_scheduled":
        transition_application(application, "interview_completed", User.query.get(company.user_id))
    return ok(interview.to_dict(), "Interview marked as completed.")


@interviews_bp.put("/<interview_id>/result")
@jwt_required()
@role_required("employer")
def record_interview_result(interview_id):
    interview, company = _employer_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)

    data = request.get_json(force=True) or {}
    result = data.get("result")
    if result not in INTERVIEW_RESULTS:
        return fail("Invalid result.", 400)
    score = data.get("score")
    if score is not None:
        try:
            score = int(score)
        except (TypeError, ValueError):
            return fail("Score must be a number.", 400)
        if not 0 <= score <= 100:
            return fail("Score must be between 0 and 100.", 400)

    interview.result = result
    interview.score = score
    if "notes" in data:
        interview.notes = data["notes"]
    if interview.status not in ("cancelled",):
        interview.status = "completed"
    db.session.commit()

    actor = User.query.get(company.user_id)
    log_audit(actor, "Update", "interviews", interview.id, f"Result: {result}", after={"result": result, "score": score})

    application = interview.application
    if application.status == "interview_scheduled":
        transition_application(application, "interview_completed", actor, notify=False)

    if result != "pending":
        jobseeker = application.jobseeker_profile
        jobseeker_user = User.query.get(jobseeker.user_id)
        label = RESULT_LABELS.get(result, result)
        notify_user(
            jobseeker.user_id, "interview_result", f"Interview Result: {label}",
            f"The result of your interview for {application.vacancy.title} has been recorded: {label}.",
            link="/jobseeker/interviews", socket_event="interview:result",
            socket_payload={"interview_id": str(interview.id), "result": result},
        )
        send_interview_result_email(jobseeker_user.email, application.vacancy.title, company.company_name, label)
    return ok(interview.to_dict(), "Interview result recorded.")


# ---------- Reschedule requests ----------

@interviews_bp.post("/<interview_id>/reschedule-requests")
@jwt_required()
@role_required("jobseeker")
def request_reschedule(interview_id):
    interview, profile = _jobseeker_interview(interview_id)
    if not interview:
        return fail("Interview not found.", 404)
    if interview.status in ("cancelled", "completed", "declined"):
        return fail("This interview can no longer be rescheduled.", 400)

    data = request.get_json(force=True) or {}
    try:
        preferred_date = datetime.fromisoformat(data["preferred_date"])
    except (KeyError, ValueError):
        return fail("A valid preferred date is required.", 400)

    # A new request supersedes any still-pending older one.
    for old in interview.reschedule_requests:
        if old.status == "pending":
            old.status = "superseded"

    req = InterviewRescheduleRequest(
        interview_id=interview.id,
        requested_by=profile.user_id,
        preferred_date=preferred_date,
        reason=data.get("reason"),
    )
    db.session.add(req)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "interview_reschedule_requests", req.id)

    company = interview.application.vacancy.employer_company
    employer_user = User.query.get(company.user_id)
    notify_user(
        company.user_id, "reschedule_request", "Interview Reschedule Request",
        f"{profile.full_name} requested to move the interview for {interview.application.vacancy.title} "
        f"to {_when_str(preferred_date)}.",
        link="/employer/interviews", socket_event="interview:reschedule_request",
        socket_payload=req.to_dict(),
    )
    send_reschedule_request_email(
        employer_user.email, profile.full_name, interview.application.vacancy.title,
        _when_str(preferred_date), data.get("reason"),
    )
    return ok(req.to_dict(), "Reschedule request sent.", 201)


@interviews_bp.get("/reschedule-requests/pending")
@jwt_required()
@role_required("employer")
def pending_reschedule_requests():
    company = _company()
    if not company:
        return ok([])
    requests_ = (
        InterviewRescheduleRequest.query.join(Interview).join(Application).join(Vacancy)
        .filter(Vacancy.employer_company_id == company.id, InterviewRescheduleRequest.status == "pending")
        .order_by(InterviewRescheduleRequest.created_at.asc()).all()
    )
    results = []
    for r in requests_:
        item = r.to_dict()
        item["interview"] = r.interview.to_dict()
        results.append(item)
    return ok(results)


@interviews_bp.put("/reschedule-requests/<request_id>")
@jwt_required()
@role_required("employer")
def respond_reschedule_request(request_id):
    company = _company()
    req = InterviewRescheduleRequest.query.get(request_id)
    if not req or not company or req.interview.application.vacancy.employer_company_id != company.id:
        return fail("Request not found.", 404)
    if req.status != "pending":
        return fail("This request was already handled.", 400)

    data = request.get_json(force=True) or {}
    action = data.get("action")
    if action not in ("approve", "reject", "suggest"):
        return fail("Action must be approve, reject, or suggest.", 400)

    interview = req.interview
    req.responded_by = get_jwt_identity()
    req.response_note = data.get("response_note")

    if action == "approve":
        req.status = "approved"
        interview.scheduled_date = req.preferred_date
        interview.status = "pending"  # jobseeker re-confirms the new schedule
        new_when = _when_str(req.preferred_date)
    elif action == "suggest":
        try:
            suggested = datetime.fromisoformat(data["suggested_date"])
        except (KeyError, ValueError):
            return fail("A valid suggested date is required.", 400)
        req.status = "suggested"
        req.suggested_date = suggested
        interview.scheduled_date = suggested
        interview.status = "pending"
        new_when = _when_str(suggested)
    else:
        req.status = "rejected"
        new_when = None
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "interview_reschedule_requests", req.id, f"{action}ed")

    jobseeker = interview.application.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker.user_id)
    outcome_msgs = {
        "approved": f"Your reschedule request was approved — new schedule: {new_when}.",
        "rejected": "Your reschedule request was declined — the original schedule stands.",
        "suggested": f"The employer suggested a different schedule: {new_when}. Please review and respond.",
    }
    notify_user(
        jobseeker.user_id, "reschedule_response", "Reschedule Request Update",
        f"{interview.application.vacancy.title}: {outcome_msgs[req.status]}",
        link="/jobseeker/interviews", socket_event="interview:reschedule_response",
        socket_payload={"request_id": str(req.id), "status": req.status, "interview": interview.to_dict(include_notes=False)},
    )
    send_reschedule_response_email(
        jobseeker_user.email, interview.application.vacancy.title, company.company_name,
        req.status, new_when, req.response_note,
    )
    return ok(req.to_dict(), f"Request {req.status}.")


@interviews_bp.get("/<interview_id>/invitation/pdf")
@jwt_required()
def download_invitation(interview_id):
    role = get_jwt().get("role")
    if role == "jobseeker":
        interview, _owner = _jobseeker_interview(interview_id)
    elif role == "employer":
        interview, _owner = _employer_interview(interview_id)
    else:
        interview = Interview.query.get(interview_id) if role in ("staff", "admin") else None
    if not interview:
        return fail("Interview not found.", 404)

    application = interview.application
    pdf = generate_interview_invitation(
        application.jobseeker_profile.full_name,
        application.vacancy.title,
        application.vacancy.employer_company.company_name,
        _when_str(interview.scheduled_date),
        interview.mode,
        interview.location,
        interview.meeting_link,
        interview.interviewer_name,
        now_manila().strftime("%B %d, %Y"),
    )
    return send_file(to_bytesio(pdf), mimetype="application/pdf", as_attachment=True, download_name="interview-invitation.pdf")
