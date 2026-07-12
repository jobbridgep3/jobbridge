import random
from datetime import timedelta

from flask import Blueprint, Response, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from limits import parse as parse_rate_limit
from marshmallow import ValidationError

from extensions import db, limiter
from models.employer import EmployerCompany
from models.employer_hr import EmployerHRProfile
from models.jobseeker import JobseekerProfile
from models.otp import OtpCode
from models.user import User
from schemas.auth_schemas import (
    ChangePasswordSchema,
    ForgotPasswordSchema,
    LoginSchema,
    RegisterSchema,
    ResetPasswordSchema,
    VerifyOtpSchema,
)
from services.audit_service import log_audit
from services.email_service import send_otp_email
from utils.client_ip import get_client_ip
from utils.rate_limit_keys import ip_and_email_key
from utils.recaptcha import verify_recaptcha
from utils.responses import fail, ok
from utils.timezone import now_manila

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
account_bp = Blueprint("account", __name__, url_prefix="/api")

# Registration OTP is short-lived since it's requested and used in the same sitting;
# the password-reset code gets a longer window since the user has to switch to their
# email app and back.
OTP_TTL_SECONDS = {
    "register": 60,
    "reset_password": 300,
}
DEFAULT_OTP_TTL_SECONDS = 60

# Only wrong-credential responses should burn down the login rate limit; reCAPTCHA
# failures, deactivated/unverified accounts, etc. are surfaced elsewhere and aren't
# the brute-force signal this limit exists to catch.
LOGIN_RATE_LIMIT = "5 per 15 minutes"


def _is_failed_login(response: Response) -> bool:
    return response.status_code == 401


def _reset_login_rate_limit() -> None:
    """Clears the (ip, email) login bucket so a success doesn't inherit a near-miss streak.

    Uses the same limit string and key/scope flask-limiter derives internally
    (ip_and_email_key() + this endpoint), so it targets exactly the bucket the
    /login limit above was tracking for this request.
    """
    limiter.limiter.clear(parse_rate_limit(LOGIN_RATE_LIMIT), ip_and_email_key(), request.endpoint)


def _generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def _issue_otp(user: User, purpose: str) -> int:
    """Creates a new OTP, invalidating any prior unused one for the same purpose.

    Returns the TTL in seconds so callers can tell the frontend exactly how long the
    code is valid for (driving an accurate countdown instead of a guessed duration).
    """
    OtpCode.query.filter_by(user_id=user.id, purpose=purpose, used_at=None).delete()
    code = _generate_otp()
    ttl_seconds = OTP_TTL_SECONDS.get(purpose, DEFAULT_OTP_TTL_SECONDS)
    otp = OtpCode(
        user_id=user.id,
        code=code,
        purpose=purpose,
        expires_at=now_manila() + timedelta(seconds=ttl_seconds),
    )
    db.session.add(otp)
    db.session.commit()
    send_otp_email(user.email, code, purpose)
    return ttl_seconds


@auth_bp.post("/register")
@limiter.limit("10 per 15 minutes", key_func=ip_and_email_key)
def register():
    role = "employer" if request.args.get("type") == "employer" else "jobseeker"
    try:
        payload = RegisterSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid registration data", 400, err.messages)

    if User.query.filter_by(email=payload["email"]).first():
        return fail("This email address is already registered. Please log in or use a different email.", 409)

    user = User(email=payload["email"], role=role, is_verified=False)
    user.set_password(payload["password"])
    db.session.add(user)
    db.session.flush()

    if role == "jobseeker":
        profile = JobseekerProfile(
            user_id=user.id,
            full_name=payload["full_name"],
            contact_number=payload.get("contact_number") or "",
        )
        db.session.add(profile)
    else:
        company = EmployerCompany(user_id=user.id)
        db.session.add(company)
        db.session.flush()
        hr_profile = EmployerHRProfile(
            user_id=user.id,
            employer_company_id=company.id,
            full_name=payload.get("hr_contact_name") or payload["full_name"],
            mobile_number=payload.get("contact_number") or "",
        )
        db.session.add(hr_profile)

    db.session.commit()
    ttl_seconds = _issue_otp(user, "register")
    log_audit(user, "Account Create", "auth", user.id, f"Self-registered as {role}")

    return ok(
        {"email": user.email, "role": role, "expires_in": ttl_seconds},
        "Registered. Check your email for the OTP code.",
        201,
    )


@auth_bp.post("/verify-otp")
@limiter.limit("10 per 15 minutes", key_func=ip_and_email_key)
def verify_otp():
    try:
        payload = VerifyOtpSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid data", 400, err.messages)

    user = User.query.filter_by(email=payload["email"]).first()
    if not user:
        return fail("Account not found.", 404)

    otp = (
        OtpCode.query.filter_by(user_id=user.id, purpose=payload["purpose"], used_at=None)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp or otp.code != payload["code"]:
        return fail("Invalid verification code.", 400)
    if otp.expires_at < now_manila():
        return fail("This code has expired. Please request a new one.", 400)

    if payload["purpose"] == "register":
        # This check IS the terminal action for registration, so the code is spent here.
        # reset_password's code is left unconsumed — the user still has to submit
        # /reset-password with it, which is the actual point of consumption. Marking it
        # used here too would make that follow-up call always fail as "invalid code."
        otp.used_at = now_manila()
        user.is_verified = True
    db.session.commit()
    log_audit(user, "Update", "auth", user.id, "OTP verified")

    if payload["purpose"] == "register":
        # Auto-issue a JWT so the frontend can immediately drive /complete-profile
        # (resume upload) without a separate login step in between.
        token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "email": user.email})
        return ok({"token": token, "user": user.to_dict()}, "Verified successfully.")

    return ok(message="Verified successfully.")


@auth_bp.post("/resend-otp")
@limiter.limit("5 per 15 minutes", key_func=ip_and_email_key)
def resend_otp():
    data = request.get_json(force=True) or {}
    user = User.query.filter_by(email=data.get("email")).first()
    if not user:
        return fail("Account not found.", 404)
    ttl_seconds = _issue_otp(user, data.get("purpose", "register"))
    return ok({"expires_in": ttl_seconds}, "A new code has been sent.")


@auth_bp.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT, key_func=ip_and_email_key, deduct_when=_is_failed_login)
def login():
    try:
        payload = LoginSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid login data", 400, err.messages)

    if not verify_recaptcha(payload["recaptcha_token"], get_client_ip()):
        return fail("reCAPTCHA verification failed. Please try again.", 400)

    user = User.query.filter_by(email=payload["email"]).first()
    if not user or not user.check_password(payload["password"]):
        log_audit(None, "Login", "auth", None, f"Failed login attempt for {payload['email']}", status="failed")
        return fail("Invalid email or password.", 401)
    if not user.is_active:
        return fail("This account has been deactivated. Contact PESO staff.", 403)
    if not user.is_verified:
        return fail("Please verify your email before logging in.", 403)

    user.last_login_at = now_manila()
    db.session.commit()
    _reset_login_rate_limit()

    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role, "email": user.email})
    log_audit(user, "Login", "auth", user.id)

    return ok({"token": token, "user": user.to_dict()}, "Login successful.")


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user:
        return fail("User not found.", 404)
    return ok(user.to_dict())


@auth_bp.put("/change-password")
@jwt_required()
def change_password():
    try:
        payload = ChangePasswordSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid data", 400, err.messages)

    user = User.query.get(get_jwt_identity())
    if not user or not user.check_password(payload["current_password"]):
        return fail("Current password is incorrect.", 400)

    user.set_password(payload["new_password"])
    user.must_change_password = False
    db.session.commit()
    log_audit(user, "Password Change", "auth", user.id)

    return ok(message="Password changed successfully.")


@account_bp.delete("/account")
@jwt_required()
def deactivate_account():
    """DELETE /api/account — soft-delete; Admin can reactivate."""
    user = User.query.get(get_jwt_identity())
    if not user:
        return fail("User not found.", 404)
    user.is_active = False
    db.session.commit()
    log_audit(user, "Update", "account", user.id, "Self-deactivated")
    return ok(message="Account deactivated.")


@auth_bp.post("/forgot-password")
@limiter.limit("5 per 15 minutes", key_func=ip_and_email_key)
def forgot_password():
    try:
        payload = ForgotPasswordSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid data", 400, err.messages)

    user = User.query.filter_by(email=payload["email"]).first()
    if user:
        _issue_otp(user, "reset_password")
    # Always respond 200 (with the same fixed TTL) to avoid leaking which emails are
    # registered — expires_in is a constant, not derived from whether user exists.
    return ok(
        {"expires_in": OTP_TTL_SECONDS["reset_password"]},
        "If that email is registered, a reset code has been sent.",
    )


@auth_bp.post("/reset-password")
@limiter.limit("5 per 15 minutes", key_func=ip_and_email_key)
def reset_password():
    try:
        payload = ResetPasswordSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid data", 400, err.messages)

    user = User.query.filter_by(email=payload["email"]).first()
    if not user:
        return fail("Invalid request.", 400)

    otp = (
        OtpCode.query.filter_by(user_id=user.id, purpose="reset_password", used_at=None)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp or otp.code != payload["code"] or otp.expires_at < now_manila():
        return fail("Invalid or expired reset code.", 400)

    otp.used_at = now_manila()
    user.set_password(payload["new_password"])
    db.session.commit()
    log_audit(user, "Password Change", "auth", user.id, "Password reset via OTP")

    return ok(message="Password reset successfully. You may now log in.")
