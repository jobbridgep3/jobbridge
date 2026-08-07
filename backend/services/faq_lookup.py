"""Static-fact intent router for the AI assistant.

A handful of purely factual questions (office hours, address, phone, email) need no
database query and no LLM reasoning — matching them here and returning a canned answer
lets the assistant skip the Groq round-trip entirely, per Phase 3's "only call the AI
when natural-language understanding is genuinely needed."

These facts are hardcoded, mirroring frontend/src/config/siteInfo.js, rather than a new
DB table — a deliberate choice (see the Phase 3 plan) since there is no editing UI for
either today. KNOWN TRADEOFF: this is a second source of truth. If SITE_INFO in the
frontend ever changes, _FACTS below must be updated by hand to match.

Triggers are deliberately multi-word/specific (e.g. "office hour", not bare "office") so
this never misfires on a message that actually needs real reasoning — any non-match
falls through to normal retrieval + Groq.
"""

_FACTS = {
    "office_hours": (
        "PESO Pila's office hours are Monday to Friday, 8:00 AM – 5:00 PM "
        "(except national and local holidays).",
        ["office hour", "opening hour", "operating hour", "what time", "when are you open", "when do you open"],
    ),
    "address": (
        "PESO Pila is located at the Municipal Hall Complex, Pila, Laguna 4010.",
        ["your address", "where are you located", "where is your office", "office location", "how to get to your office"],
    ),
    "phone": (
        "You can reach PESO Pila at (049) 559-05-50 (telefax) or 0906 649 4583 (mobile).",
        ["phone number", "contact number", "telefax", "mobile number", "your number"],
    ),
    "email": (
        "You can email PESO Pila at jobbridgepesooffice@gmail.com.",
        ["your email", "email address"],
    ),
}


def match(message: str) -> str | None:
    """Returns a canned answer if the message clearly asks for a static fact, else None."""
    lower = message.lower()
    for answer, triggers in _FACTS.values():
        if any(trigger in lower for trigger in triggers):
            return answer
    return None
