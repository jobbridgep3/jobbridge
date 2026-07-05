import re

from marshmallow import Schema, ValidationError, fields, validate, validates

# Keep the allowed special characters in one place so the error message and the regex
# never drift apart.
PASSWORD_SPECIAL_CHARS = r"""!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/"""
_UPPER_RE = re.compile(r"[A-Z]")
_LOWER_RE = re.compile(r"[a-z]")
_DIGIT_RE = re.compile(r"[0-9]")
_SPECIAL_RE = re.compile(r"[" + PASSWORD_SPECIAL_CHARS + r"]")


def validate_strong_password(value: str) -> None:
    """Shared strength policy for every password field: registration, password reset,
    and password change. A plain validator function (rather than a field subclass) so
    it stays one source of truth callable from any schema that accepts a new password.
    """
    errors = []
    if len(value) < 8:
        errors.append("Must be at least 8 characters long.")
    if not _UPPER_RE.search(value):
        errors.append("Must contain at least one uppercase letter (A-Z).")
    if not _LOWER_RE.search(value):
        errors.append("Must contain at least one lowercase letter (a-z).")
    if not _DIGIT_RE.search(value):
        errors.append("Must contain at least one number (0-9).")
    if not _SPECIAL_RE.search(value):
        errors.append("Must contain at least one special character (e.g. !@#$%^&*).")
    if errors:
        raise ValidationError(errors)


class RegisterSchema(Schema):
    class Meta:
        # The frontend sends a confirm_password field for client-side match validation
        # only; the backend never needs it. Ignore unknown fields instead of rejecting
        # the whole request (marshmallow 3 raises on unknown fields by default).
        unknown = "exclude"

    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate_strong_password)
    full_name = fields.String(required=True, validate=validate.Length(min=2, max=255))
    contact_number = fields.String(load_default="")
    # employer-only fields
    hr_contact_name = fields.String(load_default="")
    agree_to_terms = fields.Boolean(required=True)

    @validates("agree_to_terms")
    def validate_agree_to_terms(self, value, **kwargs):
        if not value:
            raise ValidationError("You must agree to the Terms and Conditions and Privacy Policy to register.")


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True)
    recaptcha_token = fields.String(required=True, validate=validate.Length(min=1))


class VerifyOtpSchema(Schema):
    email = fields.Email(required=True)
    code = fields.String(required=True, validate=validate.Length(equal=6))
    purpose = fields.String(load_default="register")


class ChangePasswordSchema(Schema):
    current_password = fields.String(required=True)
    new_password = fields.String(required=True, validate=validate_strong_password)


class ForgotPasswordSchema(Schema):
    email = fields.Email(required=True)


class ResetPasswordSchema(Schema):
    email = fields.Email(required=True)
    code = fields.String(required=True, validate=validate.Length(equal=6))
    new_password = fields.String(required=True, validate=validate_strong_password)
