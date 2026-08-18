from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError

from extensions import db
from models.employer import EmployerCompany
from models.jobfair import JobFair, JobFairBooth, JobFairPosition, JobFairRegistration
from models.jobseeker import JobseekerProfile
from models.notification import Notification
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.email_service import (
    send_jobfair_booth_status_email,
    send_jobfair_published_email,
    send_jobfair_registration_confirmation_email,
)
from services.excel_service import build_excel_report
from services.jobfair_capacity_service import (
    lock_jobfair_for_employer_registration,
    lock_jobfair_for_jobseeker_registration,
    next_registration_number,
)
from services.notification_service import notify_board, notify_user
from services.pdf_service import generate_table_report, to_bytesio
from services.qr_service import generate_qr_data_url
from services.storage_service import upload_file, validate_upload_file
from sockets.events import emit_broadcast, emit_to_role
from utils.decorators import role_required
from utils.html_sanitizer import sanitize_html
from utils.responses import fail, ok
from utils.timezone import iso_manila, now_manila, parse_manila, to_manila

jobfair_bp = Blueprint("jobfair", __name__, url_prefix="/api")
staff_jobfair_bp = Blueprint("staff_jobfair", __name__, url_prefix="/api/staff/jobfair")

PUBLIC_STATUSES = ("published", "ongoing", "completed")
# Active browse-list only — completed ("Ended") fairs drop off the active list but
# stay reachable via My Registrations / My Participations and the detail route,
# which still use PUBLIC_STATUSES above.
ACTIVE_LIST_STATUSES = ("published", "ongoing")

# One canonical display format for every backend-generated date/time string
# (emails, PDFs, notifications) — matches the frontend's lib/manilaTime.js
# canonical format so the event's schedule reads identically everywhere.
DATETIME_FMT = "%b %d, %Y %I:%M %p"
DATE_FMT = "%b %d, %Y"


# ---------- Shared read ----------

@jobfair_bp.get("/jobfair")
@jwt_required(optional=True)
def list_jobfairs():
    role = get_jwt().get("role") if get_jwt_identity() else None
    query = JobFair.query
    if role in ("staff", "admin"):
        if request.args.get("status"):
            query = query.filter_by(status=request.args["status"])
    else:
        query = query.filter(JobFair.status.in_(ACTIVE_LIST_STATUSES))
    if request.args.get("upcoming"):
        query = query.filter(JobFair.event_date >= now_manila()).order_by(JobFair.event_date.asc())
    else:
        query = query.order_by(JobFair.event_date.desc())
    fairs = query.all()
    results = [f.to_dict() for f in fairs]

    if role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        if company:
            # One bulk query instead of one per card, so the "Browse Job Fairs"
            # grid can show "Registered" vs "Register as Participant" per fair.
            booths_by_fair = {
                b.jobfair_id: b for b in JobFairBooth.query.filter_by(employer_company_id=company.id).all()
            }
            for result, fair in zip(results, fairs):
                booth = booths_by_fair.get(fair.id)
                if booth:
                    result["my_booth"] = booth.to_dict()
    return ok(results)


@jobfair_bp.get("/jobfair/<jobfair_id>")
@jwt_required(optional=True)
def get_jobfair(jobfair_id):
    role = get_jwt().get("role") if get_jwt_identity() else None
    fair = JobFair.query.get(jobfair_id)
    if not fair or (role not in ("staff", "admin") and fair.status not in PUBLIC_STATUSES):
        return fail("Job fair not found.", 404)
    result = fair.to_dict()
    booths = fair.booths if role in ("staff", "admin") else [b for b in fair.booths if b.status == "confirmed"]
    result["booths"] = [b.to_dict() for b in booths]

    if role == "jobseeker":
        profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
        registration = (
            JobFairRegistration.query.filter_by(jobfair_id=fair.id, jobseeker_profile_id=profile.id).first()
            if profile else None
        )
        if registration:
            result["my_registration"] = {**registration.to_dict(), "qr_data_url": generate_qr_data_url(registration.qr_token)}
    elif role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        booth = JobFairBooth.query.filter_by(jobfair_id=fair.id, employer_company_id=company.id).first() if company else None
        if booth:
            result["my_booth"] = booth.to_dict()

    # Vacancies the participating employers explicitly included in this fair
    # ("Include in Job Fair"), so attendees can browse openings before the
    # event. Also requires a still-confirmed registration, so a later-
    # suspended registration's vacancies drop off without needing to clear
    # every tag. This is informational only — no application-management flow
    # is attached to it.
    company_ids = [b.employer_company_id for b in fair.booths if b.status == "confirmed"]
    if company_ids:
        vacancies = (
            Vacancy.query.filter(
                Vacancy.tagged_for_jobfair_id == fair.id,
                Vacancy.employer_company_id.in_(company_ids),
                Vacancy.status == "published",
            )
            .order_by(Vacancy.created_at.desc()).limit(50).all()
        )
        result["vacancies"] = [
            {"id": str(v.id), "title": v.title, "company_name": v.employer_company.company_name, "job_type": v.job_type}
            for v in vacancies
        ]
    else:
        result["vacancies"] = []
    return ok(result)


# ---------- Jobseeker ----------

@jobfair_bp.post("/jobfair/<jobfair_id>/register")
@jwt_required()
@role_required("jobseeker")
def register_jobfair(jobfair_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)

    fair, capacity_ok, error = lock_jobfair_for_jobseeker_registration(jobfair_id)
    if not capacity_ok:
        return fail(error, 400 if fair else 404)
    if JobFairRegistration.query.filter_by(jobfair_id=fair.id, jobseeker_profile_id=profile.id).first():
        db.session.rollback()
        return fail("Already registered for this job fair.", 409)

    # Bounded retry: JobFairRegistration has THREE unique constraints
    # (jobfair_id+jobseeker_profile_id, registration_number, qr_token) — an
    # IntegrityError doesn't necessarily mean a genuine duplicate registration
    # for this fair, so we re-check that specific condition before reporting
    # it, and retry with a freshly-generated number otherwise (e.g. a
    # registration_number collision, which is unrelated to this fair/jobseeker).
    registration = None
    committed = False
    for _attempt in range(3):
        registration = JobFairRegistration(
            jobfair_id=fair.id, jobseeker_profile_id=profile.id,
            registration_number=next_registration_number(),
        )
        db.session.add(registration)
        try:
            db.session.commit()
            committed = True
            break
        except IntegrityError:
            db.session.rollback()
            if JobFairRegistration.query.filter_by(jobfair_id=fair.id, jobseeker_profile_id=profile.id).first():
                return fail("Already registered for this job fair.", 409)
    if not committed:
        return fail("Could not complete registration — please try again.", 409)
    log_audit(User.query.get(profile.user_id), "Create", "jobfair_registrations", registration.id, f"Registered for {fair.name}")

    user = User.query.get(profile.user_id)
    qr_data_url = generate_qr_data_url(registration.qr_token)
    send_jobfair_registration_confirmation_email(user.email, profile.full_name, fair, registration.registration_number, qr_data_url)
    notify_user(
        user.id, "jobfair_registered", "Job Fair Registration Confirmed",
        f"You are registered for {fair.name}. Registration No.: {registration.registration_number}.",
        link="/jobseeker/jobfair", socket_event="jobfair:registered",
        socket_payload={"jobfair_id": str(fair.id), "registration_id": str(registration.id)},
    )
    notify_board(
        [("staff", "/staff/jobfair")],
        "jobfair_board", "New Job Fair Registrant",
        f"{profile.full_name} registered for {fair.name}.",
        socket_event="jobfair:registrant",
        socket_payload={"jobfair_id": str(fair.id), "registration_id": str(registration.id)},
    )
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(
        {**registration.to_dict(), "qr_data_url": qr_data_url},
        f"Registered! Your registration number is {registration.registration_number}.", 201,
    )


@jobfair_bp.get("/jobfair/my-registrations")
@jwt_required()
@role_required("jobseeker")
def my_registrations():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    registrations = (
        JobFairRegistration.query.filter_by(jobseeker_profile_id=profile.id)
        .join(JobFair).order_by(JobFair.event_date.desc()).all()
    )
    return ok([r.to_dict() for r in registrations])


@jobfair_bp.get("/jobfair/<jobfair_id>/registration-form/pdf")
@jwt_required()
@role_required("jobseeker")
def download_registration_form(jobfair_id):
    from services.pdf_service import generate_jobfair_registration_form

    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    fair = JobFair.query.get(jobfair_id)
    registration = (
        JobFairRegistration.query.filter_by(jobfair_id=jobfair_id, jobseeker_profile_id=profile.id).first()
        if profile and fair else None
    )
    if not registration:
        return fail("You are not registered for this job fair.", 404)

    pdf = generate_jobfair_registration_form(
        {
            "full_name": profile.full_name,
            "contact_number": profile.contact_number,
            "barangay": profile.barangay,
            "municipality": profile.municipality,
            "province": profile.province,
            "preferred_job_position": profile.preferred_job_position,
        },
        {
            "name": fair.name,
            "event_date_str": to_manila(fair.event_date).strftime(DATETIME_FMT) if fair.event_date else "",
            "registration_deadline_str": to_manila(fair.registration_deadline).strftime(DATETIME_FMT) if fair.registration_deadline else "",
            "venue": fair.venue,
            "contact_person": fair.contact_person,
            "requirements": fair.requirements,
        },
        registration.registration_number or "",
        generate_qr_data_url(registration.qr_token),
        now_manila().strftime(DATE_FMT),
    )
    return send_file(to_bytesio(pdf), mimetype="application/pdf", as_attachment=True, download_name="jobfair-registration.pdf")


@jobfair_bp.get("/jobfair/<jobfair_id>/registrants")
@jwt_required()
@role_required("employer", "staff", "admin")
def list_registrants(jobfair_id):
    """Registered jobseekers of a fair — for participating employers and PESO."""
    role = get_jwt().get("role")
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        booth = JobFairBooth.query.filter_by(jobfair_id=fair.id, employer_company_id=company.id, status="confirmed").first() if company else None
        if not booth:
            return fail("Register for this job fair to view registrants.", 403)
    registrants = [
        {
            "registration_number": r.registration_number,
            "jobseeker_name": r.jobseeker_profile.full_name,
            "municipality": r.jobseeker_profile.municipality,
            "preferred_position": r.jobseeker_profile.preferred_job_position,
            "attended": r.attended,
            "registered_at": iso_manila(r.created_at),
        }
        for r in fair.registrations
    ]
    return ok(registrants)


# ---------- Employer ----------

@jobfair_bp.post("/jobfair/<jobfair_id>/register-booth")
@jwt_required()
@role_required("employer")
def register_booth(jobfair_id):
    """Employer registers as a participant for this job fair — approval-gated
    by staff/admin, in-person only (no booth/QR/application-linking flow)."""
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not company:
        return fail("Complete your company profile first.", 400)
    if company.accreditation_status != "accredited":
        return fail("Your company must be PESO-accredited before participating in a job fair.", 403)

    fair, capacity_ok, error = lock_jobfair_for_employer_registration(jobfair_id)
    if not capacity_ok:
        return fail(error, 400 if fair else 404)

    existing = JobFairBooth.query.filter_by(jobfair_id=fair.id, employer_company_id=company.id).first()
    if existing and existing.status != "cancelled":
        db.session.rollback()
        return fail("Already registered for this job fair.", 409)

    if existing:
        # Re-registering after a withdrawal — reuse the same row (the
        # jobfair_id+employer_company_id pair is unique, so a second insert
        # would fail) rather than leaving the employer permanently locked out.
        booth = existing
        booth.status = "pending"
        booth.review_remarks = None
        booth.reviewed_by = None
        booth.reviewed_at = None
        booth.booth_name = company.company_name
        audit_action, audit_note = "Update", f"Re-registered for {fair.name}"
    else:
        booth = JobFairBooth(
            jobfair_id=fair.id, employer_company_id=company.id, status="pending",
            booth_name=company.company_name,
        )
        db.session.add(booth)
        audit_action, audit_note = "Create", f"Registered for {fair.name}"
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return fail("Already registered for this job fair.", 409)
    log_audit(User.query.get(company.user_id), audit_action, "jobfair_booths", booth.id, audit_note, after={"status": "pending"})
    notify_board(
        [("staff", "/staff/jobfair")],
        "jobfair_board", "New Employer Registration",
        f"{company.company_name} registered as a participant for {fair.name}.",
        socket_event="jobfair:booth_requested",
        socket_payload={"jobfair_id": str(fair.id), "jobfair_name": fair.name, "booth_id": str(booth.id), "company_name": company.company_name},
    )
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(booth.to_dict(), "Registration submitted — pending PESO review.", 201)


@jobfair_bp.put("/jobfair/<jobfair_id>/booth")
@jwt_required()
@role_required("employer")
def update_booth(jobfair_id):
    """Employer withdraws their own pending/confirmed registration — staff
    review (approve/reject/suspend) is the only path back to "confirmed", so
    this never lets an employer self-confirm past that gate."""
    fair = JobFair.query.get(jobfair_id)
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    booth = JobFairBooth.query.filter_by(jobfair_id=jobfair_id, employer_company_id=company.id).first() if company else None
    if not booth:
        return fail("Registration not found — register for this job fair first.", 404)
    data = request.get_json(force=True) or {}
    was_confirmed = booth.status == "confirmed"
    cancelled = False
    if data.get("action") == "cancel":
        if booth.status in ("pending", "confirmed"):
            booth.status = "cancelled"
            cancelled = True
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "jobfair_booths", booth.id)
    if cancelled:
        if was_confirmed:
            notify_board(
                [("staff", "/staff/jobfair")],
                "jobfair_board", "Registration Withdrawn",
                f"{company.company_name} withdrew their confirmed registration for {fair.name}.",
                socket_event="jobfair:booth_cancelled",
                socket_payload={"jobfair_id": str(jobfair_id), "booth_id": str(booth.id), "company_name": company.company_name},
            )
        emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(booth.to_dict(), "Registration withdrawn." if cancelled else "Registration updated.")


@jobfair_bp.post("/jobfair/<jobfair_id>/positions")
@jwt_required()
@role_required("employer")
def create_jobfair_position(jobfair_id):
    """A job-fair-only position a CONFIRMED employer plans to offer in person
    at this event — deliberately not a Vacancy: no staff approval, no online
    application, no general job search visibility. See JobFairPosition."""
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    booth = JobFairBooth.query.filter_by(jobfair_id=jobfair_id, employer_company_id=company.id).first() if company else None
    if not booth or booth.status != "confirmed":
        return fail("Your registration for this job fair must be confirmed before adding positions.", 403)
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return fail("Position title is required.", 400)

    position = JobFairPosition(
        booth_id=booth.id, title=title, description=data.get("description") or None,
        job_type=data.get("job_type") or None, num_slots=data.get("num_slots") or None,
    )
    db.session.add(position)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "jobfair_positions", position.id, f"Added position for {booth.jobfair.name}")
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(position.to_dict(), "Position added.", 201)


@jobfair_bp.delete("/jobfair/<jobfair_id>/positions/<position_id>")
@jwt_required()
@role_required("employer")
def delete_jobfair_position(jobfair_id, position_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    booth = JobFairBooth.query.filter_by(jobfair_id=jobfair_id, employer_company_id=company.id).first() if company else None
    position = JobFairPosition.query.filter_by(id=position_id, booth_id=booth.id).first() if booth else None
    if not position:
        return fail("Position not found.", 404)
    db.session.delete(position)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Delete", "jobfair_positions", position_id)
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(message="Position removed.")


# ---------- Staff CRUD + lifecycle ----------

FAIR_FIELDS = (
    "name", "description", "venue", "municipality", "contact_person", "contact_number",
    "requirements", "max_employer_slots", "max_jobseeker_slots",
)


def _apply_fair_fields(fair, data):
    for field in FAIR_FIELDS:
        if field in data:
            value = sanitize_html(data[field]) if field == "description" else data[field]
            setattr(fair, field, value)
    # parse_manila localizes the naive 'YYYY-MM-DDTHH:MM' wall-clock string the
    # DatePicker/TimePicker pair sends as Asia/Manila local time before storing
    # it — using datetime.fromisoformat() directly here previously stored it as
    # naive-treated-as-UTC, silently shifting every job fair time by 8 hours.
    for dt_field in ("event_date", "end_time", "registration_deadline"):
        if data.get(dt_field):
            setattr(fair, dt_field, parse_manila(data[dt_field]))
        elif dt_field in data and not data[dt_field]:
            setattr(fair, dt_field, None)


@staff_jobfair_bp.post("")
@jwt_required()
@role_required("staff", "admin")
def create_jobfair():
    data = request.get_json(force=True) or {}
    if not data.get("event_date"):
        return fail("Event date is required.", 400)
    fair = JobFair(status="draft", created_by=get_jwt_identity(), name="", venue="")
    _apply_fair_fields(fair, data)
    if not fair.name or not fair.venue:
        return fail("Name and venue are required.", 400)
    db.session.add(fair)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "jobfair", fair.id)
    return ok(fair.to_dict(), "Job fair created as a draft — publish it when ready.", 201)


@staff_jobfair_bp.put("/<jobfair_id>")
@jwt_required()
@role_required("staff", "admin")
def update_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if fair.status == "archived":
        return fail("An archived job fair can no longer be edited.", 400)
    data = request.get_json(force=True) or {}
    _apply_fair_fields(fair, data)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "jobfair", fair.id)

    # Notify registered participants of changes to a live event.
    if fair.status in ("published", "ongoing") and (data.get("event_date") or data.get("venue")):
        payload = fair.to_dict()
        for registration in fair.registrations:
            notify_user(
                registration.jobseeker_profile.user_id, "jobfair_updated", "Job Fair Updated",
                f"Details of {fair.name} have changed — please review the event page.",
                link=f"/jobseeker/jobfair/{fair.id}", socket_event="jobfair:updated", socket_payload=payload,
            )
        for booth in fair.booths:
            notify_user(
                booth.employer_company.user_id, "jobfair_updated", "Job Fair Updated",
                f"Details of {fair.name} have changed — please review the event page.",
                link="/employer/jobfair", socket_event="jobfair:updated", socket_payload=payload,
            )
        emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(fair.to_dict(), "Job fair updated.")


@staff_jobfair_bp.delete("/<jobfair_id>")
@jwt_required()
@role_required("staff", "admin")
def delete_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if fair.status != "draft":
        return fail("Only draft job fairs can be deleted — archive published ones instead.", 400)
    db.session.delete(fair)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "jobfair", jobfair_id)
    return ok(message="Draft job fair deleted.")


@staff_jobfair_bp.post("/<jobfair_id>/publish")
@jwt_required()
@role_required("staff", "admin")
def publish_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if fair.status != "draft":
        return fail(f"Cannot publish a job fair from status '{fair.status}'.", 400)
    if not fair.name or not fair.venue or not fair.event_date:
        return fail("Name, venue, and event date are required before publishing.", 400)

    fair.status = "published"
    fair.published_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Publish", "jobfair", fair.id, before={"status": "draft"}, after={"status": "published"})
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})

    # Website notifications: one persisted row per user (bulk insert), one socket per role.
    when = to_manila(fair.event_date).strftime(DATETIME_FMT)
    deadline = to_manila(fair.registration_deadline).strftime(DATETIME_FMT) if fair.registration_deadline else None
    message = f"{fair.name} — {when} at {fair.venue}. Register now!"
    recipients = []  # (user, role)
    for profile in JobseekerProfile.query.all():
        user = User.query.get(profile.user_id)
        if user and user.is_active:
            recipients.append((user, "jobseeker"))
    for company in EmployerCompany.query.filter_by(accreditation_status="accredited").all():
        user = User.query.get(company.user_id)
        if user and user.is_active:
            recipients.append((user, "employer"))

    for user, role in recipients:
        link = "/jobseeker/jobfair" if role == "jobseeker" else "/employer/jobfair"
        db.session.add(Notification(user_id=user.id, type="jobfair_published", title="Upcoming Job Fair!", message=message, link=link))
    db.session.commit()

    payload = fair.to_dict()
    emit_to_role("jobseeker", "jobfair:published", payload)
    emit_to_role("employer", "jobfair:published", payload)
    for user, role in recipients:
        send_jobfair_published_email(user.email, fair.name, when, fair.venue, deadline, role)

    return ok(fair.to_dict(), f"Job fair published — {len(recipients)} user(s) notified.")


def _review_booth(jobfair_id, booth_id, new_status, required_remarks, from_statuses, socket_event, audit_action):
    fair = JobFair.query.get(jobfair_id)
    booth = JobFairBooth.query.filter_by(id=booth_id, jobfair_id=jobfair_id).first()
    if not fair or not booth:
        return fail("Registration not found.", 404)
    if booth.status not in from_statuses:
        return fail(f"Cannot {audit_action.lower()} a registration from status '{booth.status}'.", 400)
    data = request.get_json(silent=True) or {}
    remarks = (data.get("remarks") or "").strip()
    if required_remarks and not remarks:
        return fail("A reason is required for this action.", 400)

    before = {"status": booth.status}
    booth.status = new_status
    booth.review_remarks = remarks or None
    booth.reviewed_by = get_jwt_identity()
    booth.reviewed_at = now_manila()
    db.session.commit()
    log_audit(
        User.query.get(get_jwt_identity()), audit_action, "jobfair_booths", booth.id,
        f"{audit_action} registration for {fair.name}", before=before, after={"status": booth.status},
    )

    user = User.query.get(booth.employer_company.user_id)
    notify_user(
        user.id, "jobfair_booth_status", f"Job Fair Registration {audit_action}d",
        f"Your registration for {fair.name} was {new_status}." + (f" Reason: {remarks}" if remarks else ""),
        link="/employer/jobfair", socket_event=socket_event,
        socket_payload={"jobfair_id": str(fair.id), "booth_id": str(booth.id), "status": new_status},
    )
    send_jobfair_booth_status_email(user.email, booth.employer_company.company_name, fair, new_status, remarks or None)
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(booth.to_dict(), f"Registration {new_status}.")


@staff_jobfair_bp.put("/<jobfair_id>/booths/<booth_id>/approve")
@jwt_required()
@role_required("staff", "admin")
def approve_booth(jobfair_id, booth_id):
    return _review_booth(jobfair_id, booth_id, "confirmed", False, ("pending",), "jobfair:booth_confirmed", "Approve")


@staff_jobfair_bp.put("/<jobfair_id>/booths/<booth_id>/reject")
@jwt_required()
@role_required("staff", "admin")
def reject_booth(jobfair_id, booth_id):
    return _review_booth(jobfair_id, booth_id, "rejected", True, ("pending",), "jobfair:booth_rejected", "Reject")


@staff_jobfair_bp.put("/<jobfair_id>/booths/<booth_id>/suspend")
@jwt_required()
@role_required("staff", "admin")
def suspend_booth(jobfair_id, booth_id):
    return _review_booth(jobfair_id, booth_id, "suspended", True, ("confirmed",), "jobfair:booth_suspended", "Suspend")


@staff_jobfair_bp.post("/<jobfair_id>/archive")
@jwt_required()
@role_required("staff", "admin")
def archive_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if fair.status == "draft":
        return fail("Drafts can be deleted instead of archived.", 400)
    before = fair.status
    fair.status = "archived"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Archive", "jobfair", fair.id, before={"status": before}, after={"status": "archived"})
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})
    return ok(fair.to_dict(), "Job fair archived.")


@staff_jobfair_bp.post("/<jobfair_id>/cancel")
@jwt_required()
@role_required("staff", "admin")
def cancel_jobfair(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    if fair.status not in ("published", "ongoing"):
        return fail("Only a published job fair can be cancelled.", 400)
    before = fair.status
    fair.status = "cancelled"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Cancel", "jobfair", fair.id, before={"status": before}, after={"status": "cancelled"})
    emit_broadcast("public:homepage_update", {"sections": ["jobfairs"]})

    payload = fair.to_dict()
    for registration in fair.registrations:
        notify_user(
            registration.jobseeker_profile.user_id, "jobfair_cancelled", "Job Fair Cancelled",
            f"{fair.name} has been cancelled by PESO.",
            link="/jobseeker/jobfair", socket_event="jobfair:updated", socket_payload=payload,
        )
    for booth in fair.booths:
        notify_user(
            booth.employer_company.user_id, "jobfair_cancelled", "Job Fair Cancelled",
            f"{fair.name} has been cancelled by PESO.",
            link="/employer/jobfair", socket_event="jobfair:updated", socket_payload=payload,
        )
    return ok(fair.to_dict(), "Job fair cancelled — participants notified.")


@staff_jobfair_bp.post("/<jobfair_id>/banner")
@jwt_required()
@role_required("staff", "admin")
def upload_banner(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach the banner image.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    fair.banner_url = upload_file(file_bytes, file.filename, f"jobfairs/{fair.id}", file.content_type or "image/png")
    db.session.commit()
    return ok(fair.to_dict(), "Banner uploaded.")


@staff_jobfair_bp.post("/<jobfair_id>/attachments")
@jwt_required()
@role_required("staff", "admin")
def upload_attachment(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach a file.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    url = upload_file(file_bytes, file.filename, f"jobfairs/{fair.id}", file.content_type or "application/octet-stream")
    fair.attachments = (fair.attachments or []) + [{"name": file.filename, "url": url}]
    db.session.commit()
    return ok(fair.to_dict(), "Attachment uploaded.")


# ---------- Attendance ----------

@staff_jobfair_bp.post("/<jobfair_id>/scan-qr")
@jwt_required()
@role_required("staff", "admin")
def scan_qr(jobfair_id):
    data = request.get_json(force=True) or {}
    token = data.get("qr_token")
    registration = JobFairRegistration.query.filter_by(jobfair_id=jobfair_id, qr_token=token).first()
    if not registration:
        return fail("Invalid QR code for this job fair.", 404)
    if registration.attended:
        return fail("This QR code has already been scanned.", 409)

    registration.attended = True
    registration.scanned_at = now_manila()
    db.session.commit()

    emit_to_role("staff", "jobfair:qr_scanned", {
        "jobfair_id": str(jobfair_id),
        "jobseeker_id": str(registration.jobseeker_profile_id),
        "jobseeker_name": registration.jobseeker_profile.full_name,
        "registration_number": registration.registration_number,
        "scan_time": iso_manila(registration.scanned_at),
    })
    return ok(registration.to_dict(), "Attendance marked.")


@staff_jobfair_bp.get("/<jobfair_id>/attendance")
@jwt_required()
@role_required("staff", "admin")
def attendance_dashboard(jobfair_id):
    """Live attendance dashboard: counts + scan log for the scanner screen."""
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    registrations = sorted(fair.registrations, key=lambda r: (r.scanned_at is None, r.scanned_at), reverse=False)
    scanned = [r for r in registrations if r.attended]
    return ok({
        "jobfair": fair.to_dict(),
        "total_registered": len(registrations),
        "total_attended": len(scanned),
        "attendance_rate": round(len(scanned) / len(registrations) * 100, 1) if registrations else 0,
        "logs": [
            {
                "registration_number": r.registration_number,
                "jobseeker_name": r.jobseeker_profile.full_name,
                "attended": r.attended,
                "scanned_at": iso_manila(r.scanned_at),
            }
            for r in sorted(fair.registrations, key=lambda r: r.scanned_at or r.created_at, reverse=True)
        ],
    })


# ---------- Reports ----------

def _full_address(street, barangay, city, province, legacy=None) -> str:
    composed = ", ".join(filter(None, [street, barangay, city, province]))
    return composed or legacy or ""


@staff_jobfair_bp.get("/<jobfair_id>/report/employers")
@jwt_required()
@role_required("staff", "admin")
def report_employers(jobfair_id):
    """Employer Participant export — Company Name, Industry/Sector, Contact
    Person, Contact Number, Email Address, Full Address."""
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    fmt = request.args.get("format", "excel")
    title = f"Employer Participants — {fair.name}"
    columns = ["Company Name", "Industry/Sector", "Contact Person", "Contact Number", "Email Address", "Full Address"]
    rows = [
        [
            company.company_name or "",
            company.industry or "",
            company.rep_name or "",
            company.rep_contact_number or company.contact_number or "",
            company.company_email or company.rep_email or "",
            _full_address(company.street_address, company.barangay_name, company.city_municipality_name, company.province_name, company.address),
        ]
        for company in (b.employer_company for b in fair.booths) if company
    ]
    log_audit(User.query.get(get_jwt_identity()), "Export", "jobfair", fair.id, "Employer participant report")
    date_str = now_manila().strftime(DATE_FMT)
    if fmt == "pdf":
        pdf_bytes = generate_table_report(title, columns, rows, date_str, landscape=True)
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="jobfair_employer_participants.pdf")
    buf = build_excel_report(title, columns, rows, landscape=True)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="jobfair_employer_participants.xlsx")


@staff_jobfair_bp.get("/<jobfair_id>/report/jobseekers")
@jwt_required()
@role_required("staff", "admin")
def report_jobseekers(jobfair_id):
    """Jobseeker Participant export — Registration Number, Full Name, Contact
    Number, Full Address, Email Address, Status."""
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    fmt = request.args.get("format", "excel")
    title = f"Jobseeker Participants — {fair.name}"
    columns = ["Registration Number", "Full Name", "Contact Number", "Full Address", "Email Address", "Status"]
    rows = []
    for r in fair.registrations:
        profile = r.jobseeker_profile
        if not profile:
            continue
        user = User.query.get(profile.user_id)
        rows.append([
            r.registration_number or "",
            profile.full_name or "",
            profile.contact_number or "",
            _full_address(None, profile.barangay, profile.municipality, profile.province, profile.address),
            user.email if user else "",
            "Attended" if r.attended else "Registered",
        ])
    log_audit(User.query.get(get_jwt_identity()), "Export", "jobfair", fair.id, "Jobseeker participant report")
    date_str = now_manila().strftime(DATE_FMT)
    if fmt == "pdf":
        pdf_bytes = generate_table_report(title, columns, rows, date_str, landscape=True)
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="jobfair_jobseeker_participants.pdf")
    buf = build_excel_report(title, columns, rows, landscape=True)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="jobfair_jobseeker_participants.xlsx")
