import logging

from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import join_room, rooms

from extensions import socketio

logger = logging.getLogger(__name__)


@socketio.on("connect")
def handle_connect():
    token = request.args.get("token")
    if not token:
        return
    try:
        decoded = decode_token(token)
        user_id = decoded["sub"]
        role = decoded.get("role")
        join_room(f"user_{user_id}")
        if role:
            join_room(f"role_{role}")
        logger.info("Socket connected: user_%s role_%s", user_id, role)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Socket connect rejected — invalid token: %s", exc)


@socketio.on("disconnect")
def handle_disconnect():
    # Flask-SocketIO removes this client from its rooms automatically after this
    # handler returns — rooms() still reflects membership at this point, so this
    # is the last chance to log which user/role rooms were attached to the socket
    # that just disconnected (previously a silent no-op, making disconnects
    # invisible in the logs entirely).
    logger.info("Socket disconnected: sid=%s rooms=%s", request.sid, rooms())


def emit_to_user(user_id, event: str, payload: dict):
    socketio.emit(event, payload, room=f"user_{user_id}")


def emit_to_role(role: str, event: str, payload: dict):
    socketio.emit(event, payload, room=f"role_{role}")


def emit_broadcast(event: str, payload: dict):
    socketio.emit(event, payload)
