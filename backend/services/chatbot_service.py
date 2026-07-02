"""Chatbot assistant. Real path calls Dialogflow ES when DIALOGFLOW_PROJECT_ID + Google
credentials are configured; otherwise falls back to a small rule-based canned-response
engine so the floating widget stays functional without a Google Cloud project.
"""

import logging
import os
import uuid

from flask import current_app

logger = logging.getLogger(__name__)

_CANNED_RESPONSES = [
    (["spes", "special program"], "SPES (Special Program for Employment of Students) helps qualified students find summer/part-time work. Apply under the SPES module in your dashboard."),
    (["dilp", "livelihood"], "DILP (DOLE Integrated Livelihood Program) provides livelihood assistance. You can apply under the DILP module."),
    (["owwa", "ofw"], "OWWA assistance is for OFWs and returning workers. Apply under the OWWA module with your OWWA membership details."),
    (["job fair"], "Upcoming PESO job fairs are listed under Job Fair in your dashboard — register there to get a QR code for attendance."),
    (["apply", "application"], "You can apply to any Active job posting from Job Search — just click Apply and track your status under My Applications."),
    (["resume", "profile"], "Upload your resume under My Profile — we'll auto-extract your skills and experience to improve your job match scores."),
    (["hello", "hi", "kumusta"], "Kumusta! I'm the JobBridge assistant. Ask me about job searching, SPES, DILP, OWWA, or job fairs."),
]

_DEFAULT_RESPONSE = (
    "I'm currently running in offline assistant mode (no Dialogflow connection configured). "
    "I can help with basic questions about job search, SPES, DILP, OWWA, and job fairs — "
    "for anything else, please visit the PESO Pila office or contact staff via Notifications."
)


def is_dialogflow_configured() -> bool:
    return bool(current_app.config.get("DIALOGFLOW_PROJECT_ID") and current_app.config.get("GOOGLE_APPLICATION_CREDENTIALS"))


def _canned_reply(message: str) -> str:
    lower = message.lower()
    for keywords, reply in _CANNED_RESPONSES:
        if any(kw in lower for kw in keywords):
            return reply
    return _DEFAULT_RESPONSE


def get_reply(message: str, session_id: str = None) -> dict:
    session_id = session_id or uuid.uuid4().hex

    if not is_dialogflow_configured():
        return {"reply": _canned_reply(message), "session_id": session_id, "mode": "mock"}

    try:
        from google.cloud import dialogflow_v2 as dialogflow

        project_id = current_app.config["DIALOGFLOW_PROJECT_ID"]
        session_client = dialogflow.SessionsClient()
        session = session_client.session_path(project_id, session_id)
        text_input = dialogflow.TextInput(text=message, language_code="en")
        query_input = dialogflow.QueryInput(text=text_input)
        response = session_client.detect_intent(request={"session": session, "query_input": query_input})
        return {"reply": response.query_result.fulfillment_text, "session_id": session_id, "mode": "dialogflow"}
    except Exception as exc:  # noqa: BLE001
        logger.error("Dialogflow request failed, falling back to canned reply: %s", exc)
        return {"reply": _canned_reply(message), "session_id": session_id, "mode": "mock"}
