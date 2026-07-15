from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.employer import EmployerCompany
from models.jobfair import JobFair, JobFairBooth, JobFairRegistration
from models.jobseeker import JobseekerProfile
from models.notification import Notification
from models.user import User
from services.audit_service import log_audit
from services.email_service import send_email, send_jobfair_published_email
from services.excel_service import build_excel_report
from services.notification_service import notify_user
from services.pdf_service import generate_table_report, to_bytesio
from services.qr_service import generate_qr_data_url
from services.storage_service import upload_file, validate_upload_file
from sockets.events import emit_to_role
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

jobfair_bp = Blueprint("jobfair", __name__, url_prefix="/api")
staff_jobfair_bp = Blueprint("staff_jobfair", __name__, url_prefix="/api/staff/jobfair")

PUBLIC_STATUSES = ("published", "ongoing", "completed")


def _next_registration_number():
    year = now_manila().year
    prefix = f"JF-{year}-"
    latest = (
        JobFairRegistration.query.filter(JobFairRegistration.registration_number.like(f"{prefix}%"))
        .order_by(JobFairRegistration.registration_number.desc()).first()
    )
    seq = int(latest.registration_number.rsplit("-", 1)[1]) + 1 if latest and latest.registration_number else 1
    return f"{prefix}{seq:05d}"


# ---------- Shared read ----------

@jobfair_bp.get("/jobfair")
@jwt_required()
def list_jobfairs():
    role = get_jwt().get("role")
    query = JobFair.query
    if role in ("staff", "admin"):
        if request.args.get("status"):
            query = query.filter_by(status=request.args["status"])
    else:
        query = query.filter(JobFair.status.in_(PUBLIC_STATUSES))
    fairs = query.order_by(JobFair.event_date.desc()).all()
    return ok([f.to_dict() for f in fairs])


@jobfair_bp.get("/jobfair/<jobfair_id>")
@jwt_required()
def get_jobfair(jobfair_id):
    role = get_jwt().get("role")
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

    # Published vacancies of the participating employers, so attendees can browse
    # openings before the event.
    from models.vacancy import Vacancy
    company_ids = [b.employer_company_id for b in fair.booths if b.status == "confirmed"]
    if company_ids:
        vacancies = (
            Vacancy.query.filter(Vacancy.employer_company_id.in_(company_ids), Vacancy.status == "published")
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
    fair = JobFair.query.get(jobfair_id)
    if not fair or fair.status not in ("published", "ongoing"):
        return fail("This job fair is not open for registration.", 400)
    if fair.registration_deadline and now_manila() > fair.registration_deadline:
        return fail("The registration deadline for this job fair has passed.", 400)
    if fair.max_jobseeker_slots and len(fair.registrations) >= fair.max_jobseeker_slots:
        return fail("This job fair has reached its maximum number of participants.", 400)
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile first.", 400)
    if JobFairRegistration.query.filter_by(jobfair_id=fair.id, jobseeker_profile_id=profile.id).first():
        return fail("Already registered for this job fair.", 409)

    registration = JobFairRegistration(
        jobfair_id=fair.id, jobseeker_profile_id=profile.id,
        registration_number=_next_registration_number(),
    )
    db.session.add(registration)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "jobfair_registrations", registration.id, f"Registered for {fair.name}")

    user = User.query.get(profile.user_id)
    qr_data_url = generate_qr_data_url(registration.qr_token)
    when = fair.event_date.strftime("%B %d, %Y %I:%M %p") if fair.event_date else ""
    send_email(
        user.email, f"Job Fair Registration — {fair.name}",
        f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Registration Confirmed</h2>
          <p>Hi {profile.full_name}, you are registered for <b>{fair.name}</b>.</p>
          <p><b>Registration No.:</b> {registration.registration_number}<br/>
          <b>When:</b> {when}<br/><b>Where:</b> {fair.venue}</p>
          <p>Present the QR code below (or from your JobBridge account) at the venue for attendance:</p>
          <p><img src="{qr_data_url}" alt="QR Code" width="180" height="180"/></p>
          <p style="color:#64748b;font-size:12px">— PESO Pila, Laguna via JobBridge</p>
        </div>
        """,
    )
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
            "event_date_str": fair.event_date.strftime("%B %d, %Y %I:%M %p") if fair.event_date else "",
            "venue": fair.venue,
            "contact_person": fair.contact_person,
            "requirements": fair.requirements,
        },
        registration.registration_number or "",
        generate_qr_data_url(registration.qr_token),
        now_manila().strftime("%B %d, %Y"),
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
            return fail("Register a booth for this job fair to view registrants.", 403)
    registrants = [
        {
            "registration_number": r.registration_number,
            "jobseeker_name": r.jobseeker_profile.full_name,
            "municipality": r.jobseeker_profile.municipality,
            "preferred_position": r.jobseeker_profile.preferred_job_position,
            "attended": r.attended,
            "registered_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in fair.registrations
    ]
    return ok(registrants)


# ---------- Employer ----------

@jobfair_bp.post("/jobfair/<jobfair_id>/register-booth")
@jwt_required()
@role_required("employer")
def register_booth(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    if not fair or not company or fair.status not in ("published", "ongoing"):
        return fail("This job fair is not open for booth registration.", 400)
    if fair.max_employer_slots and len([b for b in fair.booths if b.status != "cancelled"]) >= fair.max_employer_slots:
        return fail("This job fair has no employer slots remaining.", 400)
    if JobFairBooth.query.filter_by(jobfair_id=fair.id, employer_company_id=company.id).first():
        return fail("Booth already registered.", 409)
    data = request.get_json(silent=True) or {}
    booth = JobFairBooth(
        jobfair_id=fair.id, employer_company_id=company.id, status="confirmed",
        booth_name=data.get("booth_name") or company.company_name,
        description=data.get("description"),
    )
    db.session.add(booth)
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Create", "jobfair_booths", booth.id, f"Booth for {fair.name}")
    return ok(booth.to_dict(), "Booth registered.", 201)


@jobfair_bp.put("/jobfair/<jobfair_id>/booth")
@jwt_required()
@role_required("employer")
def update_booth(jobfair_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    booth = JobFairBooth.query.filter_by(jobfair_id=jobfair_id, employer_company_id=company.id).first() if company else None
    if not booth:
        return fail("Booth not found — register for this job fair first.", 404)
    data = request.get_json(force=True) or {}
    for field in ("booth_name", "description"):
        if field in data:
            setattr(booth, field, data[field])
    if data.get("action") == "cancel":
        booth.status = "cancelled"
    elif data.get("action") == "confirm":
        booth.status = "confirmed"
    db.session.commit()
    log_audit(User.query.get(company.user_id), "Update", "jobfair_booths", booth.id)
    return ok(booth.to_dict(), "Booth updated.")


@jobfair_bp.post("/jobfair/<jobfair_id>/booth/materials")
@jwt_required()
@role_required("employer")
def upload_booth_material(jobfair_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    booth = JobFairBooth.query.filter_by(jobfair_id=jobfair_id, employer_company_id=company.id).first() if company else None
    if not booth:
        return fail("Booth not found — register for this job fair first.", 404)
    file = request.files.get("file")
    if not file:
        return fail("Attach a file.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)
    url = upload_file(file_bytes, file.filename, f"jobfairs/{jobfair_id}/booths/{booth.id}", file.content_type or "application/octet-stream")
    booth.materials = (booth.materials or []) + [{"name": file.filename, "url": url}]
    db.session.commit()
    return ok(booth.to_dict(), "Material uploaded.")


# ---------- Staff CRUD + lifecycle ----------

FAIR_FIELDS = (
    "name", "description", "venue", "municipality", "contact_person", "contact_number",
    "requirements", "max_employer_slots", "max_jobseeker_slots",
)


def _apply_fair_fields(fair, data):
    for field in FAIR_FIELDS:
        if field in data:
            setattr(fair, field, data[field])
    for dt_field in ("event_date", "end_time", "registration_deadline"):
        if data.get(dt_field):
            setattr(fair, dt_field, datetime.fromisoformat(data[dt_field]))
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

    # Website notifications: one persisted row per user (bulk insert), one socket per role.
    when = fair.event_date.strftime("%B %d, %Y %I:%M %p")
    deadline = fair.registration_deadline.strftime("%B %d, %Y") if fair.registration_deadline else None
    message = f"{fair.name} — {when} at {fair.venue}. Register now!"
    recipients = []  # (user, role)
    for profile in JobseekerProfile.query.all():
        user = User.query.get(profile.user_id)
        if user and user.is_active:
            recipients.append((user, "jobseeker"))
    for company in EmployerCompany.query.all():
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
    registration.scanned_at = datetime.utcnow()
    db.session.commit()

    emit_to_role("staff", "jobfair:qr_scanned", {
        "jobfair_id": str(jobfair_id),
        "jobseeker_id": str(registration.jobseeker_profile_id),
        "jobseeker_name": registration.jobseeker_profile.full_name,
        "registration_number": registration.registration_number,
        "scan_time": registration.scanned_at.isoformat(),
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
                "scanned_at": r.scanned_at.isoformat() if r.scanned_at else None,
            }
            for r in sorted(fair.registrations, key=lambda r: r.scanned_at or r.created_at, reverse=True)
        ],
    })


@staff_jobfair_bp.get("/<jobfair_id>/report")
@jwt_required()
@role_required("staff", "admin")
def jobfair_report(jobfair_id):
    """Participant / employer-participation / vacancy reports (Excel or PDF)."""
    from models.vacancy import Vacancy

    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    report_type = request.args.get("type", "participants")
    fmt = request.args.get("format", "excel")

    if report_type == "participants":
        title = f"Participants — {fair.name}"
        columns = ["Registration No.", "Jobseeker", "Municipality", "Preferred Position", "Registered", "Attended"]
        rows = [
            [
                r.registration_number or "",
                r.jobseeker_profile.full_name,
                r.jobseeker_profile.municipality or "",
                r.jobseeker_profile.preferred_job_position or "",
                r.created_at.strftime("%b %d, %Y") if r.created_at else "",
                "Yes" if r.attended else "No",
            ]
            for r in fair.registrations
        ]
    elif report_type == "employers":
        title = f"Employer Participation — {fair.name}"
        columns = ["Company", "Booth", "Status", "Published Vacancies"]
        rows = []
        for booth in fair.booths:
            vacancy_count = Vacancy.query.filter_by(employer_company_id=booth.employer_company_id, status="published").count()
            rows.append([booth.employer_company.company_name, booth.booth_name or "", booth.status, vacancy_count])
    elif report_type == "vacancies":
        title = f"Available Vacancies — {fair.name}"
        columns = ["Company", "Position", "Employment Type", "Slots"]
        company_ids = [b.employer_company_id for b in fair.booths if b.status == "confirmed"]
        vacancies = (
            Vacancy.query.filter(Vacancy.employer_company_id.in_(company_ids), Vacancy.status == "published").all()
            if company_ids else []
        )
        rows = [[v.employer_company.company_name, v.title, v.job_type or "", v.num_slots or 1] for v in vacancies]
    else:
        return fail("Unknown report type.", 400)

    log_audit(User.query.get(get_jwt_identity()), "Export", "jobfair", fair.id, f"{report_type} report")
    if fmt == "pdf":
        pdf_bytes = generate_table_report(title, columns, rows, now_manila().strftime("%B %d, %Y"))
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name=f"jobfair_{report_type}.pdf")
    buf = build_excel_report(title, columns, rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name=f"jobfair_{report_type}.xlsx")


@staff_jobfair_bp.get("/<jobfair_id>/attendance-report")
@jwt_required()
@role_required("staff", "admin")
def attendance_report(jobfair_id):
    fair = JobFair.query.get(jobfair_id)
    if not fair:
        return fail("Job fair not found.", 404)
    fmt = request.args.get("format", "excel")
    columns = ["Registration No.", "Jobseeker", "Attended", "Scanned At"]
    rows = [
        [
            r.registration_number or "",
            r.jobseeker_profile.full_name,
            "Yes" if r.attended else "No",
            r.scanned_at.strftime("%b %d, %Y %I:%M %p") if r.scanned_at else "",
        ]
        for r in fair.registrations
    ]
    log_audit(User.query.get(get_jwt_identity()), "Export", "jobfair", fair.id, "Attendance report")

    if fmt == "pdf":
        pdf_bytes = generate_table_report(f"Attendance — {fair.name}", columns, rows, now_manila().strftime("%B %d, %Y"))
        return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="attendance.pdf")

    buf = build_excel_report(f"Attendance {fair.name}", columns, rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="attendance.xlsx")
