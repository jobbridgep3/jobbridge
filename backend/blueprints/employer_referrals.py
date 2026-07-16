"""Employer-facing review of PESO-approved, vacancy-scoped referrals.

Flow: jobseeker requests a referral (backend/blueprints/referrals.py) -> PESO
staff approves it (generates the PDF) -> if the referral targets a specific
vacancy, it becomes visible here for that vacancy's employer to Accept
(promoting it into a real Application, no re-apply needed) or Reject (with a
required reason). General (non-vacancy) referrals never appear here.
"""

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.application import Application
from models.employer import EmployerCompany
from models.jobseeker import JobseekerProfile
from models.referral import ReferralLetter
from models.user import User
from models.vacancy import Vacancy
from services.application_status_service import record_initial_history
from services.audit_service import log_audit
from services.email_service import send_employer_referral_decision_email
from services.matching_service import match_score
from services.notification_service import notify_user
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

employer_referrals_bp = Blueprint("employer_referrals", __name__, url_prefix="/api/employer/referrals")


def _company() -> EmployerCompany:
    return EmployerCompany.query.filter_by(user_id=get_jwt_identity()).first()


def _base_query(company):
    return (
        ReferralLetter.query.join(Vacancy, ReferralLetter.vacancy_id == Vacancy.id)
        .filter(Vacancy.employer_company_id == company.id)
        .filter(ReferralLetter.employer_status.isnot(None))
    )


def _owned_referral(company, referral_id):
    return _base_query(company).filter(ReferralLetter.id == referral_id).first()


@employer_referrals_bp.get("")
@jwt_required()
@role_required("employer")
def list_referrals():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)

    query = _base_query(company)
    if request.args.get("status"):
        query = query.filter(ReferralLetter.employer_status == request.args["status"])
    if request.args.get("q"):
        like = f"%{request.args['q']}%"
        query = query.join(JobseekerProfile, ReferralLetter.jobseeker_profile_id == JobseekerProfile.id).filter(
            db.or_(ReferralLetter.referral_number.ilike(like), JobseekerProfile.full_name.ilike(like)),
        )

    referrals = query.order_by(ReferralLetter.created_at.desc()).all()
    return ok([r.to_dict() for r in referrals])


@employer_referrals_bp.get("/summary")
@jwt_required()
@role_required("employer")
def referrals_summary():
    company = _company()
    if not company:
        return fail("Company profile not found.", 404)

    base = _base_query(company)
    total = base.count()
    pending = base.filter(ReferralLetter.employer_status == "pending").count()
    accepted = base.filter(ReferralLetter.employer_status == "accepted").count()
    rejected = base.filter(ReferralLetter.employer_status == "rejected").count()
    return ok({
        "total": total, "pending": pending, "accepted": accepted, "rejected": rejected,
        "converted": accepted,  # accepting a referral atomically creates/links the Application — same count
    })


@employer_referrals_bp.get("/<referral_id>")
@jwt_required()
@role_required("employer")
def get_referral(referral_id):
    company = _company()
    referral = _owned_referral(company, referral_id) if company else None
    if not referral:
        return fail("Referral not found.", 404)

    result = referral.to_dict()
    result["jobseeker_profile"] = referral.jobseeker_profile.to_dict()
    result["vacancy"] = referral.vacancy.to_dict() if referral.vacancy else None
    result["match_score"] = match_score(referral.jobseeker_profile, referral.vacancy) if referral.vacancy else None
    result["application"] = referral.application.to_dict() if referral.application_id else None
    return ok(result)


@employer_referrals_bp.put("/<referral_id>/accept")
@jwt_required()
@role_required("employer")
def accept_referral(referral_id):
    company = _company()
    referral = _owned_referral(company, referral_id) if company else None
    if not referral:
        return fail("Referral not found.", 404)
    if referral.employer_status != "pending":
        return fail(f"This referral has already been reviewed (status: {referral.employer_status}).", 400)

    employer_user = User.query.get(get_jwt_identity())
    application = Application.query.filter_by(
        vacancy_id=referral.vacancy_id, jobseeker_profile_id=referral.jobseeker_profile_id,
    ).first()
    if not application:
        score = match_score(referral.jobseeker_profile, referral.vacancy)
        application = Application(
            vacancy_id=referral.vacancy_id, jobseeker_profile_id=referral.jobseeker_profile_id,
            status="applied", match_score=score,
        )
        db.session.add(application)
        db.session.commit()
        record_initial_history(application, employer_user)

    before = {"employer_status": referral.employer_status}
    referral.application_id = application.id
    referral.employer_status = "accepted"
    referral.reviewed_by_employer = employer_user.id
    referral.employer_reviewed_at = now_manila()
    db.session.commit()
    log_audit(
        employer_user, "Accept", "referral_letters", referral.id,
        before=before, after={"employer_status": "accepted", "application_id": str(application.id)},
    )

    jobseeker_profile = referral.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker_profile.user_id)
    notify_user(
        jobseeker_user.id, "referral_accepted", "Referral Accepted",
        f"{company.company_name} accepted your referral for {referral.vacancy.title} and added you to their applicant pipeline.",
        link="/jobseeker/applications", socket_event="referral:decision", socket_payload=referral.to_dict(),
    )
    send_employer_referral_decision_email(
        jobseeker_user.email, jobseeker_profile.full_name, company.company_name, True, referral.vacancy.title,
    )
    return ok({"referral": referral.to_dict(), "application_id": str(application.id)}, "Referral accepted — applicant added to your pipeline.")


@employer_referrals_bp.put("/<referral_id>/reject")
@jwt_required()
@role_required("employer")
def reject_referral(referral_id):
    company = _company()
    referral = _owned_referral(company, referral_id) if company else None
    if not referral:
        return fail("Referral not found.", 404)
    if referral.employer_status != "pending":
        return fail(f"This referral has already been reviewed (status: {referral.employer_status}).", 400)

    data = request.get_json(force=True) or {}
    reason = (data.get("reason") or "").strip()
    if not reason:
        return fail("A reason is required to reject a referral.", 400)

    employer_user = User.query.get(get_jwt_identity())
    before = {"employer_status": referral.employer_status}
    referral.employer_status = "rejected"
    referral.employer_rejection_reason = reason
    referral.reviewed_by_employer = employer_user.id
    referral.employer_reviewed_at = now_manila()
    db.session.commit()
    log_audit(employer_user, "Reject", "referral_letters", referral.id, reason, before=before, after={"employer_status": "rejected"})

    jobseeker_profile = referral.jobseeker_profile
    jobseeker_user = User.query.get(jobseeker_profile.user_id)
    notify_user(
        jobseeker_user.id, "referral_rejected", "Referral Update",
        f"{company.company_name} was not able to move forward with your referral for {referral.vacancy.title}. Reason: {reason}",
        link="/jobseeker/applications", socket_event="referral:decision", socket_payload=referral.to_dict(),
    )
    send_employer_referral_decision_email(
        jobseeker_user.email, jobseeker_profile.full_name, company.company_name, False, referral.vacancy.title, reason,
    )
    return ok(referral.to_dict(), "Referral rejected — jobseeker notified.")


def next_referral_number():
    """REF-{year}-{seq:05d}, mirroring blueprints/jobfair.py::_next_registration_number()."""
    year = now_manila().year
    prefix = f"REF-{year}-"
    latest = (
        ReferralLetter.query.filter(ReferralLetter.referral_number.like(f"{prefix}%"))
        .order_by(ReferralLetter.referral_number.desc()).first()
    )
    seq = int(latest.referral_number.rsplit("-", 1)[1]) + 1 if latest and latest.referral_number else 1
    return f"{prefix}{seq:05d}"
