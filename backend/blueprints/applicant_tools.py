"""Application-scoped recruitment tools shared by employer and jobseeker:
per-application messaging, additional document requests, and job offers."""

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db
from models.applicant_tools import ApplicationMessage, DocumentRequest, JobOffer
from models.application import Application
from models.employer import EmployerCompany
from models.jobseeker import JobseekerDocument, JobseekerProfile
from models.user import User
from services.application_status_service import transition_application
from services.audit_service import log_audit
from services.email_service import (
    send_application_message_email,
    send_document_request_email,
    send_job_offer_email,
    send_offer_response_email,
)
from services.notification_service import notify_user
from services.pdf_service import generate_job_offer
from services.storage_service import upload_file, validate_upload_file
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

applicant_tools_bp = Blueprint("applicant_tools", __name__, url_prefix="/api")


def _accessible_application(application_id):
    """The application if the requester is its jobseeker or the vacancy's employer.

    Returns (application, role, party) where party is the JobseekerProfile or
    EmployerCompany of the requester.
    """
    role = get_jwt().get("role")
    application = Application.query.get(application_id)
    if not application:
        return None, role, None
    if role == "jobseeker":
        profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
        if profile and application.jobseeker_profile_id == profile.id:
            return application, role, profile
    elif role == "employer":
        company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
        if company and application.vacancy.employer_company_id == company.id:
            return application, role, company
    return None, role, None


def _counterparty_user_id(application, sender_role):
    if sender_role == "jobseeker":
        return application.vacancy.employer_company.user_id
    return application.jobseeker_profile.user_id


# ---------- Messages ----------

@applicant_tools_bp.get("/applications/<application_id>/messages")
@jwt_required()
def list_messages(application_id):
    application, role, _party = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    # Opening the thread marks the other side's messages as read.
    my_id = get_jwt_identity()
    unread = [m for m in application.messages if m.read_at is None and str(m.sender_user_id) != str(my_id)]
    if unread:
        for m in unread:
            m.read_at = now_manila()
        db.session.commit()
    return ok([m.to_dict() for m in application.messages])


@applicant_tools_bp.post("/applications/<application_id>/messages")
@jwt_required()
def send_message(application_id):
    application, role, party = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return fail("Message cannot be empty.", 400)
    if len(body) > 5000:
        return fail("Message is too long.", 400)

    message = ApplicationMessage(application_id=application.id, sender_user_id=get_jwt_identity(), body=body)
    db.session.add(message)
    db.session.commit()

    sender_name = party.full_name if role == "jobseeker" else party.company_name
    recipient_role = "employer" if role == "jobseeker" else "jobseeker"
    recipient_id = _counterparty_user_id(application, role)
    link = f"/employer/applicants/{application.id}" if recipient_role == "employer" else "/jobseeker/applications"
    notify_user(
        recipient_id, "application_message", "New message",
        f"{sender_name} sent a message about the application for {application.vacancy.title}.",
        link=link, socket_event="application:message", socket_payload=message.to_dict(),
    )
    recipient_user = User.query.get(recipient_id)
    preview = body if len(body) <= 300 else body[:297] + "…"
    send_application_message_email(recipient_user.email, sender_name, application.vacancy.title, preview, recipient_role)
    return ok(message.to_dict(), "Message sent.", 201)


# ---------- Document requests ----------

@applicant_tools_bp.get("/applications/<application_id>/document-requests")
@jwt_required()
def list_document_requests(application_id):
    application, _role, _party = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    return ok([r.to_dict() for r in application.document_requests])


@applicant_tools_bp.post("/applications/<application_id>/document-requests")
@jwt_required()
@role_required("employer")
def create_document_request(application_id):
    application, _role, company = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    data = request.get_json(force=True) or {}
    label = (data.get("document_label") or "").strip()
    if not label:
        return fail("Document label is required.", 400)

    req = DocumentRequest(
        application_id=application.id, requested_by=get_jwt_identity(),
        document_label=label, note=data.get("note"),
    )
    db.session.add(req)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "document_requests", req.id, label)

    jobseeker = application.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker.user_id)
    notify_user(
        jobseeker.user_id, "document_request", "Additional Document Requested",
        f"{company.company_name} requested: {label} — for your application to {application.vacancy.title}.",
        link="/jobseeker/applications", socket_event="application:document_request",
        socket_payload=req.to_dict(),
    )
    send_document_request_email(
        jobseeker_user.email, jobseeker.full_name, application.vacancy.title,
        company.company_name, label, data.get("note"),
    )
    return ok(req.to_dict(), "Document request sent.", 201)


@applicant_tools_bp.put("/document-requests/<request_id>/submit")
@jwt_required()
@role_required("jobseeker")
def submit_document_request(request_id):
    req = DocumentRequest.query.get(request_id)
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not req or not profile or req.application.jobseeker_profile_id != profile.id:
        return fail("Request not found.", 404)
    if req.status != "pending":
        return fail("This request was already handled.", 400)

    file = request.files.get("file")
    if not file:
        return fail("Attach the requested document file.", 400)
    file_bytes = file.read()
    error = validate_upload_file(file_bytes, file.filename)
    if error:
        return fail(error, 400)

    url = upload_file(file_bytes, file.filename, "additional_documents", file.content_type or "application/octet-stream")
    document = JobseekerDocument(
        profile_id=profile.id, document_type="additional", file_url=url, original_filename=file.filename,
    )
    db.session.add(document)
    db.session.flush()
    req.status = "submitted"
    req.submitted_document_id = document.id
    req.submitted_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "document_requests", req.id, "Document submitted")

    company = req.application.vacancy.employer_company
    notify_user(
        company.user_id, "document_request", "Requested Document Submitted",
        f"{profile.full_name} submitted the requested document ({req.document_label}) "
        f"for {req.application.vacancy.title}.",
        link=f"/employer/applicants/{req.application_id}", socket_event="application:document_request",
        socket_payload=req.to_dict(),
    )
    return ok(req.to_dict(), "Document submitted.")


@applicant_tools_bp.put("/document-requests/<request_id>/cancel")
@jwt_required()
@role_required("employer")
def cancel_document_request(request_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    req = DocumentRequest.query.get(request_id)
    if not req or not company or req.application.vacancy.employer_company_id != company.id:
        return fail("Request not found.", 404)
    if req.status != "pending":
        return fail("Only pending requests can be cancelled.", 400)
    req.status = "cancelled"
    db.session.commit()
    return ok(req.to_dict(), "Request cancelled.")


# ---------- Job offers ----------

@applicant_tools_bp.get("/applications/<application_id>/offer")
@jwt_required()
def get_offer(application_id):
    application, _role, _party = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    return ok(application.job_offer.to_dict() if application.job_offer else None)


@applicant_tools_bp.post("/applications/<application_id>/offer")
@jwt_required()
@role_required("employer")
def create_offer(application_id):
    application, _role, company = _accessible_application(application_id)
    if not application:
        return fail("Application not found.", 404)
    if application.job_offer and application.job_offer.status != "withdrawn":
        return fail("An offer already exists for this application.", 409)

    data = request.get_json(force=True) or {}
    position = (data.get("position") or application.vacancy.title or "").strip()
    if not position:
        return fail("Position is required.", 400)

    actor = User.query.get(get_jwt_identity())
    if application.status != "offer_extended":
        success, error = transition_application(application, "offer_extended", actor, notify=False)
        if not success:
            db.session.rollback()
            return fail(error, 400)

    offer = application.job_offer
    if offer:  # re-offer after a withdrawn one
        offer.status = "offered"
        offer.responded_at = None
    else:
        offer = JobOffer(application_id=application.id, position=position)
        db.session.add(offer)
    offer.position = position
    offer.salary_offer = data.get("salary_offer")
    offer.employment_type = data.get("employment_type")
    offer.start_date = data.get("start_date") or None
    offer.terms = data.get("terms")

    jobseeker = application.jobseeker_profile
    try:
        pdf = generate_job_offer(
            jobseeker.full_name, position, company.company_name,
            f"PHP {float(data['salary_offer']):,.2f}" if data.get("salary_offer") else None,
            data.get("employment_type"), data.get("start_date"), data.get("terms"),
            now_manila().strftime("%B %d, %Y"),
        )
        offer.pdf_url = upload_file(pdf, "job-offer.pdf", "job_offers", "application/pdf")
    except RuntimeError:
        # WeasyPrint native libs unavailable (local Windows dev) — offer still works without the PDF.
        offer.pdf_url = None
    db.session.commit()
    log_audit(actor, "Create", "job_offers", offer.id, f"Offer for {position}")

    jobseeker_user = User.query.get(jobseeker.user_id)
    notify_user(
        jobseeker.user_id, "job_offer", "You received a job offer!",
        f"{company.company_name} extended you a job offer for {position}.",
        link="/jobseeker/applications", socket_event="offer:new", socket_payload=offer.to_dict(),
    )
    send_job_offer_email(jobseeker_user.email, jobseeker.full_name, application.vacancy.title, company.company_name, position)
    return ok(offer.to_dict(), "Job offer sent.", 201)


@applicant_tools_bp.put("/offers/<offer_id>/respond")
@jwt_required()
@role_required("jobseeker")
def respond_offer(offer_id):
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    offer = JobOffer.query.get(offer_id)
    if not offer or not profile or offer.application.jobseeker_profile_id != profile.id:
        return fail("Offer not found.", 404)
    if offer.status != "offered":
        return fail("This offer can no longer be responded to.", 400)

    data = request.get_json(force=True) or {}
    action = data.get("action")
    if action not in ("accept", "decline"):
        return fail("Action must be accept or decline.", 400)

    offer.status = "accepted" if action == "accept" else "declined"
    offer.responded_at = now_manila()
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Update", "job_offers", offer.id, f"Offer {offer.status}")

    company = offer.application.vacancy.employer_company
    employer_user = User.query.get(company.user_id)
    accepted = action == "accept"
    notify_user(
        company.user_id, "offer_response", f"Job Offer {offer.status.title()}",
        f"{profile.full_name} {offer.status} your job offer for {offer.position}."
        + (" You can now mark them as Hired." if accepted else ""),
        link=f"/employer/applicants/{offer.application_id}", socket_event="offer:response",
        socket_payload=offer.to_dict(),
    )
    send_offer_response_email(employer_user.email, profile.full_name, offer.position, accepted)
    return ok(offer.to_dict(), f"Offer {offer.status}.")


@applicant_tools_bp.put("/offers/<offer_id>/withdraw")
@jwt_required()
@role_required("employer")
def withdraw_offer(offer_id):
    company = EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()
    offer = JobOffer.query.get(offer_id)
    if not offer or not company or offer.application.vacancy.employer_company_id != company.id:
        return fail("Offer not found.", 404)
    if offer.status != "offered":
        return fail("Only a pending offer can be withdrawn.", 400)
    offer.status = "withdrawn"
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "job_offers", offer.id, "Offer withdrawn")

    jobseeker = offer.application.jobseeker_profile
    notify_user(
        jobseeker.user_id, "offer_response", "Job Offer Withdrawn",
        f"{company.company_name} withdrew the job offer for {offer.position}.",
        link="/jobseeker/applications", socket_event="offer:response", socket_payload=offer.to_dict(),
    )
    return ok(offer.to_dict(), "Offer withdrawn.")
