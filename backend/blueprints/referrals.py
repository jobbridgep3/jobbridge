"""Jobseeker-requested PESO referral letters.

Jobseeker requests a letter (optionally for a specific vacancy) → PESO staff
approves (PDF generated) or rejects → the approved letter auto-attaches to the
matching application at apply time (see blueprints/jobs.py).
"""

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import APPLICATION_STATUS_LABELS, Application
from models.jobseeker import JobseekerProfile
from models.referral import ReferralLetter
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.email_service import send_referral_decision_email, send_referral_pending_employer_review_email
from services.notification_service import notify_role, notify_user
from services.application_status_service import is_currently_employed_at_company
from services.pdf_service import generate_referral_letter
from services.storage_service import upload_file
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

referrals_bp = Blueprint("referrals", __name__, url_prefix="/api")


@referrals_bp.post("/referral-letters")
@jwt_required()
@role_required("jobseeker")
def request_referral_letter():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return fail("Complete your profile before requesting a referral letter.", 400)

    data = request.get_json(force=True) or {}
    vacancy_id = data.get("vacancy_id") or None
    stale_hire = False
    if vacancy_id:
        vacancy = Vacancy.query.get(vacancy_id)
        if not vacancy or vacancy.status != "published":
            return fail("Vacancy not found or not open.", 404)

        currently_employed = is_currently_employed_at_company(profile.id, vacancy.employer_company_id)
        if currently_employed:
            return fail(
                "You are currently employed by this company. Referral requests are disabled until your employment ends.", 409,
            )

        existing_application = Application.query.filter_by(
            vacancy_id=vacancy_id, jobseeker_profile_id=profile.id,
        ).first()
        if existing_application:
            # A "hired" application whose employment has since ended is stale —
            # don't let it block a fresh referral request for this vacancy.
            stale_hire = existing_application.status == "hired" and not currently_employed
            if existing_application.status == "rejected":
                return fail(
                    "You have already been rejected for this vacancy. You can no longer submit a referral request for this job opening.", 409,
                )
            if existing_application.status != "cancelled" and not stale_hire:
                if existing_application.status == "hired":
                    return fail("You are already hired for this vacancy.", 409)
                label = APPLICATION_STATUS_LABELS.get(existing_application.status, existing_application.status)
                return fail(
                    f"You already have an active application ({label}) for this vacancy — a referral request isn't needed.", 409,
                )

    existing_referral = ReferralLetter.query.filter(
        ReferralLetter.jobseeker_profile_id == profile.id,
        ReferralLetter.vacancy_id == vacancy_id,
        ReferralLetter.status.in_(("requested", "approved")),
    ).first()
    if existing_referral and not stale_hire:
        what = "referral request for this vacancy" if vacancy_id else "general referral request"
        return fail(f"You already have a {existing_referral.status} {what}.", 409)

    letter = ReferralLetter(
        jobseeker_profile_id=profile.id,
        vacancy_id=vacancy_id,
        status="requested",
        reason=data.get("reason"),
        requested_by=profile.user_id,
    )
    db.session.add(letter)
    db.session.commit()
    log_audit(User.query.get(profile.user_id), "Create", "referral_letters", letter.id, "Referral letter requested")

    notify_role("staff", "referral:requested", letter.to_dict())
    notify_role("admin", "referral:requested", letter.to_dict())
    return ok(letter.to_dict(), "Referral letter request sent to PESO.", 201)


@referrals_bp.get("/referral-letters/my")
@jwt_required()
@role_required("jobseeker")
def my_referral_letters():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    letters = (
        ReferralLetter.query.filter_by(jobseeker_profile_id=profile.id)
        .order_by(ReferralLetter.created_at.desc()).all()
    )
    return ok([l.to_dict() for l in letters])


# ---------- Staff review ----------

@referrals_bp.get("/staff/referral-letters")
@jwt_required()
@role_required("staff", "admin")
def staff_list_referral_letters():
    query = ReferralLetter.query.options(
        db.joinedload(ReferralLetter.jobseeker_profile),
        db.joinedload(ReferralLetter.vacancy).joinedload(Vacancy.employer_company),
    )
    if request.args.get("status"):
        query = query.filter_by(status=request.args["status"])
    letters = query.order_by(ReferralLetter.created_at.desc()).all()
    return ok([l.to_dict() for l in letters])


@referrals_bp.put("/staff/referral-letters/<letter_id>/approve")
@jwt_required()
@role_required("staff", "admin")
def approve_referral_letter(letter_id):
    letter = ReferralLetter.query.get(letter_id)
    if not letter:
        return fail("Request not found.", 404)
    if letter.status == "approved" and letter.pdf_url:
        return fail("This request was already approved.", 400)

    staff_user = User.query.get(get_jwt_identity())
    profile = letter.jobseeker_profile
    vacancy = letter.vacancy

    pdf_bytes = generate_referral_letter(
        profile.full_name,
        vacancy.title if vacancy else None,
        vacancy.employer_company.company_name if vacancy and vacancy.employer_company else None,
        now_manila().strftime("%B %d, %Y"),
    )
    letter.pdf_url = upload_file(pdf_bytes, "referral.pdf", folder=f"referrals/{letter.id}", content_type="application/pdf")
    letter.status = "approved"
    letter.reviewed_by = staff_user.id
    letter.generated_by = staff_user.id
    db.session.commit()
    log_audit(staff_user, "Approve", "referral_letters", letter.id, before={"status": "requested"}, after={"status": "approved"})

    jobseeker_user = User.query.get(profile.user_id)
    notify_user(
        profile.user_id, "referral_ready", "Referral Letter Ready",
        f"Your referral letter{f' for {vacancy.title}' if vacancy else ''} is ready to download.",
        link="/jobseeker/applications", socket_event="referral:ready",
        socket_payload=letter.to_dict(),
    )
    send_referral_decision_email(jobseeker_user.email, profile.full_name, True, vacancy.title if vacancy else None)

    # Vacancy-scoped referrals also become visible to that vacancy's employer —
    # see blueprints/employer_referrals.py for the Accept/Reject flow.
    if vacancy is not None:
        from blueprints.employer_referrals import next_referral_number

        letter.employer_status = "pending"
        letter.referral_number = next_referral_number()
        db.session.commit()
        employer_user = User.query.get(vacancy.employer_company.user_id) if vacancy.employer_company else None
        if employer_user:
            notify_user(
                employer_user.id, "referral_pending_review", "New Referral Received",
                f"PESO referred {profile.full_name} for {vacancy.title}.",
                link="/employer/referrals", socket_event="referral:employer_pending",
                socket_payload=letter.to_dict(),
            )
            send_referral_pending_employer_review_email(
                employer_user.email, vacancy.employer_company.company_name, profile.full_name, vacancy.title,
            )

    return ok(letter.to_dict(), "Referral letter approved and generated.")


@referrals_bp.put("/staff/referral-letters/<letter_id>/reject")
@jwt_required()
@role_required("staff", "admin")
def reject_referral_letter(letter_id):
    letter = ReferralLetter.query.get(letter_id)
    if not letter:
        return fail("Request not found.", 404)
    if letter.status != "requested":
        return fail("Only pending requests can be rejected.", 400)

    data = request.get_json(force=True) or {}
    staff_user = User.query.get(get_jwt_identity())
    letter.status = "rejected"
    letter.rejection_reason = data.get("reason")
    letter.reviewed_by = staff_user.id
    db.session.commit()
    log_audit(staff_user, "Reject", "referral_letters", letter.id, data.get("reason"), before={"status": "requested"}, after={"status": "rejected"})

    profile = letter.jobseeker_profile
    vacancy = letter.vacancy
    jobseeker_user = User.query.get(profile.user_id)
    notify_user(
        profile.user_id, "referral_rejected", "Referral Letter Request Update",
        f"Your referral letter request{f' for {vacancy.title}' if vacancy else ''} was not approved."
        + (f" Reason: {data['reason']}" if data.get("reason") else ""),
        link="/jobseeker/applications", socket_event="referral:decision",
        socket_payload=letter.to_dict(),
    )
    send_referral_decision_email(jobseeker_user.email, profile.full_name, False, vacancy.title if vacancy else None, data.get("reason"))
    return ok(letter.to_dict(), "Request rejected.")
