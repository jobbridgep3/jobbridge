from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from services.chatbot_service import get_reply
from utils.responses import fail, ok

chatbot_bp = Blueprint("chatbot", __name__, url_prefix="/api/chatbot")


@chatbot_bp.post("/message")
@jwt_required(optional=True)
def send_message():
    data = request.get_json(force=True) or {}
    message = data.get("message", "").strip()
    if not message:
        return fail("Message is required.", 400)
    result = get_reply(message, data.get("session_id"))
    return ok(result)
