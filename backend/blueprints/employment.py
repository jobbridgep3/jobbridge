from datetime import date

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.employer import EmployerCompany
from models.employment import (
    EMPLOYMENT_END_STATUSES,
    EMPLOYMENT_STATUS_LABELS,
    EmploymentRecord,
    EmploymentStatusHistory,
)
from models.jobseeker import JobseekerProfile
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_employment_status_email
from services.notification_service import notify_role, notify_user
from sockets.events import emit_broadcast
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

employment_bp = Blueprint("employment", __name__, url_prefix="/api/employment")

# Which statuses a record can move to from its current status.
EMPLOYMENT_TRANSITIONS = {
    "pending_deployment": {"active", "probationary", "terminated", "resigned"},
    "active": {"probationary", "regular", "contract_ended", "resigned", "terminated", "completed"},
    "probationary": {"regular", "active", "contract_ended", "resigned", "terminated", "completed"},
    "regular": {"contract_ended", "resigned", "terminated", "completed"},
    "contract_ended": set(),
    "resigned": set(),
    "terminated": set(),
    "completed": set(),
}


def transition_employment(record, new_status, actor_user, note=None, notify=True):
    """Single path for employment status changes: history + audit + notifications.

    Returns (ok, error_message).
    """
    old_status = record.status
    if new_status == old_status:
        return True, None
    if new_status not in EMPLOYMENT_TRANSITIONS.get(old_status, set()):
        return False, (
            f"Cannot move this record from '{EMPLOYMENT_STATUS_LABELS.get(old_status, old_status)}' "
            f"to '{EMPLOYMENT_STATUS_LABELS.get(new_status, new_status)}'."
        )

    record.status = new_status
    if new_status in EMPLOYMENT_END_STATUSES:
        record.end_date = record.end_date or date.today()
    if new_status == "terminated" and note:
        record.termination_reason = note
    db.session.add(EmploymentStatusHistory(
        record_id=record.id, from_status=old_status, to_status=new_status,
        changed_by=actor_user.id if actor_user else None, note=note,
    ))
    db.session.commit()
    log_audit(
        actor_user, "Update", "employment", record.id,
        f"Status: {old_status} -> {new_status}" + (f" — {note}" if note else ""),
        before={"status": old_status}, after={"status": new_status},
    )
    emit_broadcast("public:homepage_update", {"sections": ["stats"]})

    if notify:
        label = EMPLOYMENT_STATUS_LABELS.get(new_status, new_status)
        jobseeker = record.jobseeker_profile
        notify_user(
            jobseeker.user_id, "employment_updated", f"Employment update: {label}",
            f"Your employment status as {record.position} at {record.employer_company.company_name} is now \"{label}\".",
            link="/jobseeker/employment", socket_event="employment:updated",
            socket_payload=record.to_dict(),
        )
        jobseeker_user = User.query.get(jobseeker.user_id)
        if jobseeker_user:
            send_employment_status_email(
                jobseeker_user.email, jobseeker.full_name, record.position,
                record.employer_company.company_name, label, note,
            )
        notify_role("staff", "employment:updated", record.to_dict())
    return True, None


def create_employment_record_for_application(application):
    """Called when an employer marks an applicant as Hired — auto-creates the
    employment record as Pending Deployment, copying terms from the accepted job
    offer when present, else from the vacancy."""
    vacancy = application.vacancy
    offer = application.job_offer if application.job_offer and application.job_offer.status == "accepted" else None
    record = EmploymentRecord(
        application_id=application.id,
        jobseeker_profile_id=application.jobseeker_profile_id,
        employer_company_id=vacancy.employer_company_id,
        position=offer.position if offer else vacancy.title,
        salary=offer.salary_offer if offer else vacancy.salary_min,
        employment_type=(offer.employment_type if offer else None) or vacancy.job_type,
        work_arrangement=vacancy.work_arrangement,
        start_date=(offer.start_date if offer and offer.start_date else date.today()),
        status="pending_deployment",
    )
    db.session.add(record)
    db.session.flush()
    db.session.add(EmploymentStatusHistory(record_id=record.id, from_status=None, to_status="pending_deployment"))
    db.session.commit()

    jobseeker_user_id = application.jobseeker_profile.user_id
    notify_user(
        jobseeker_user_id, "employment_created", "You're Hired!",
        f"You have been marked as hired for {record.position}. Your employment record is now in Pending Deployment.",
        link="/jobseeker/employment", socket_event="employment:updated",
        socket_payload=record.to_dict(),
    )
    notify_role("staff", "employment:updated", record.to_dict())
    return record


def _record_with_timeline(record):
    result = record.to_dict()
    events = [h.to_dict() for h in record.status_history]
    if not events:
        # Records created before the history table existed get a synthetic start event.
        events = [{
            "id": None, "record_id": str(record.id), "from_status": None,
            "to_status": record.status, "to_status_label": EMPLOYMENT_STATUS_LABELS.get(record.status, record.status),
            "changed_by_role": "system", "note": None,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        }]
    result["timeline"] = events
    return result


@employment_bp.get("/my")
@jwt_required()
@role_required("jobseeker")
def my_employment():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    records = EmploymentRecord.query.filter_by(jobseeker_profile_id=profile.id).order_by(EmploymentRecord.start_date.desc()).all()
    return ok([_record_with_timeline(r) for r in records])


@employment_bp.get("/my/export/pdf")
@jwt_required()
@role_required("jobseeker")
def export_my_employment():
    from services.pdf_service import generate_table_report, to_bytesio
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Profile not found.", 404)
    records = EmploymentRecord.query.filter_by(jobseeker_profile_id=profile.id).order_by(EmploymentRecord.start_date.desc()).all()
    rows = [
        [
            r.employer_company.company_name,
            r.position,
            (r.employment_type or "").replace("_", " ").title(),
            r.start_date.strftime("%b %d, %Y") if r.start_date else "",
            r.end_date.strftime("%b %d, %Y") if r.end_date else "Present",
            EMPLOYMENT_STATUS_LABELS.get(r.status, r.status),
        ]
        for r in records
    ]
    pdf = generate_table_report(
        f"Employment History — {profile.full_name}",
        ["Employer", "Position", "Employment Type", "Start Date", "End Date", "Status"],
        rows, now_manila().strftime("%B %d, %Y"),
    )
    return send_file(to_bytesio(pdf), mimetype="application/pdf", as_attachment=True, download_name="employment-history.pdf")


@employment_bp.get("/my-hires")
@jwt_required()
@role_required("employer")
def my_hires():
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not company:
        return ok([])
    query = EmploymentRecord.query.filter_by(employer_company_id=company.id)
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    records = query.order_by(EmploymentRecord.start_date.desc()).all()
    return ok([_record_with_timeline(r) for r in records])


@employment_bp.get("/analytics")
@jwt_required()
@role_required("employer")
def employer_employment_analytics():
    from models.application import Application, ApplicationStatusHistory
    from models.vacancy import Vacancy

    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not company:
        return fail("Company profile not found.", 404)

    records = EmploymentRecord.query.filter_by(employer_company_id=company.id).all()
    status_counts = {}
    for r in records:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1

    total_applications = Application.query.join(Vacancy).filter(Vacancy.employer_company_id == company.id).count()
    hired_count = (
        Application.query.join(Vacancy)
        .filter(Vacancy.employer_company_id == company.id, Application.status == "hired").count()
    )
    ongoing = sum(status_counts.get(s, 0) for s in ("pending_deployment", "active", "probationary", "regular"))
    ended = sum(status_counts.get(s, 0) for s in ("contract_ended", "resigned", "terminated", "completed"))

    # Average days from application to hire, from the status history timestamps.
    hire_events = (
        db.session.query(ApplicationStatusHistory, Application)
        .join(Application, ApplicationStatusHistory.application_id == Application.id)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Vacancy.employer_company_id == company.id, ApplicationStatusHistory.to_status == "hired")
        .all()
    )
    day_spans = [
        (history.created_at - application.created_at).days
        for history, application in hire_events
        if history.created_at and application.created_at
    ]
    avg_hiring_days = round(sum(day_spans) / len(day_spans), 1) if day_spans else None

    return ok({
        "status_counts": status_counts,
        "total_hired": len(records),
        "hiring_success_rate": round(hired_count / total_applications * 100, 1) if total_applications else 0,
        "retention_rate": round(ongoing / len(records) * 100, 1) if records else 0,
        "average_hiring_days": avg_hiring_days,
        "contract_ending_soon": status_counts.get("probationary", 0),
        "ended": ended,
    })


@employment_bp.get("/export")
@jwt_required()
@role_required("employer")
def export_my_hires():
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not company:
        return fail("Company profile not found.", 404)
    query = EmploymentRecord.query.filter_by(employer_company_id=company.id)
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    records = query.order_by(EmploymentRecord.start_date.desc()).all()
    columns = ["Employee", "Position", "Employment Type", "Start Date", "End Date", "Status"]
    rows = [
        [
            r.jobseeker_profile.full_name,
            r.position,
            (r.employment_type or "").replace("_", " ").title(),
            r.start_date.strftime("%b %d, %Y") if r.start_date else "",
            r.end_date.strftime("%b %d, %Y") if r.end_date else "Present",
            EMPLOYMENT_STATUS_LABELS.get(r.status, r.status),
        ]
        for r in records
    ]
    log_audit(User.query.get(get_jwt_identity()), "Export", "employment")
    if request.args.get("format") == "pdf":
        from services.pdf_service import generate_table_report, to_bytesio
        pdf = generate_table_report(f"Employees — {company.company_name}", columns, rows, now_manila().strftime("%B %d, %Y"))
        return send_file(to_bytesio(pdf), mimetype="application/pdf", as_attachment=True, download_name="employees.pdf")
    from services.excel_service import build_excel_report
    buf = build_excel_report("Employees", columns, rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="employees.xlsx")


@employment_bp.put("/<record_id>/status")
@jwt_required()
@role_required("employer")
def update_employment_status(record_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    record = EmploymentRecord.query.get(record_id)
    if not record or not company or record.employer_company_id != company.id:
        return fail("Employment record not found.", 404)
    data = request.get_json(force=True) or {}
    new_status = data.get("status")
    if new_status not in EMPLOYMENT_TRANSITIONS:
        return fail("Invalid status.", 400)

    if "remarks" in data:
        record.remarks = data["remarks"]
    actor = User.query.get(get_jwt_identity())
    success, error = transition_employment(
        record, new_status, actor, note=data.get("note") or data.get("termination_reason"),
    )
    if not success:
        db.session.rollback()
        return fail(error, 400)
    return ok(record.to_dict(), "Employment status updated.")
