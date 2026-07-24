"""Public Contact Us inquiry form — unauthenticated, isolated from every other module."""

from flask import Blueprint, request
from marshmallow import ValidationError

from extensions import limiter
from schemas.contact_schemas import ContactSchema
from services.email_service import send_contact_inquiry_email
from utils.client_ip import get_client_ip
from utils.responses import fail, ok

contact_bp = Blueprint("contact", __name__, url_prefix="/api/contact")


@contact_bp.post("")
@limiter.limit("5 per hour", key_func=get_client_ip)
def submit_contact():
    try:
        payload = ContactSchema().load(request.get_json(force=True) or {})
    except ValidationError as err:
        return fail("Invalid contact form data", 400, err.messages)

    if payload["website"]:
        # Honeypot tripped — a bot filled in a field real visitors never see.
        # Respond as if it succeeded so the bot doesn't learn to skip the field.
        return ok(None, "Message sent. PESO Pila will get back to you soon.", 201)

    send_contact_inquiry_email(payload["name"], payload["email"], payload["subject"], payload["message"])
    return ok(None, "Message sent. PESO Pila will get back to you soon.", 201)
