import re

from marshmallow import ValidationError

CONTACT_NUMBER_RE = re.compile(r"^[0-9]{7,15}$")


def validate_contact_number(value: str) -> None:
    """Digits only, 7-15 characters. No-ops on empty/None so it doesn't conflict with
    the field being optional — only fires when a value is actually being submitted.
    """
    if value and not CONTACT_NUMBER_RE.match(value):
        raise ValidationError("Contact number must contain digits only (7-15 digits).")
