"""Chat conversation persistence for the AI assistant (post-launch Feature 4).

Ownership is checked on every read/write here — a conversation id belonging to another
user (or a garbage/foreign id) is never trusted, the same defensive posture every other
user-owned resource in this app follows (e.g. employer.py's _company()-based ownership
checks). Public/anonymous callers never reach this module at all — blueprints/assistant.py
only calls it when `identity` is truthy.

`session_id` is repurposed as the conversation's id once a user is authenticated (Phase 1
explicitly left it "ready for when chat-history lands" — this is that phase). A
client-supplied id that isn't a valid UUID, doesn't exist, or belongs to someone else is
treated the same way as "no id" — a fresh conversation is started rather than erroring,
so a stale/tampered id degrades gracefully instead of breaking the chat.
"""

import uuid

from extensions import db
from models.assistant_conversation import AssistantConversation
from utils.timezone import now_manila

MAX_TITLE_LENGTH = 80


def _derive_title(first_message: str) -> str:
    text = (first_message or "").strip() or "New conversation"
    if len(text) <= MAX_TITLE_LENGTH:
        return text
    return text[:MAX_TITLE_LENGTH].rsplit(" ", 1)[0] + "…"


def _find_owned(conversation_id, user_id):
    if not conversation_id:
        return None
    try:
        uuid.UUID(str(conversation_id))
    except (ValueError, AttributeError, TypeError):
        return None
    return AssistantConversation.query.filter_by(id=conversation_id, user_id=user_id).first()


def upsert_turn(conversation_id, user_id, user_message: str, assistant_reply: str, attachment_label: str = None) -> str:
    """Creates a new conversation, or appends to one the caller actually owns. Returns
    the conversation's id (str) — the caller treats this as the new session_id."""
    conversation = _find_owned(conversation_id, user_id)

    user_turn = {"role": "user", "content": user_message}
    if attachment_label:
        user_turn["attachment"] = attachment_label
    assistant_turn = {"role": "assistant", "content": assistant_reply}

    if conversation:
        conversation.messages = (conversation.messages or []) + [user_turn, assistant_turn]
        conversation.last_message_at = now_manila()
    else:
        conversation = AssistantConversation(
            user_id=user_id,
            title=_derive_title(user_message),
            messages=[user_turn, assistant_turn],
            last_message_at=now_manila(),
        )
        db.session.add(conversation)

    db.session.commit()
    return str(conversation.id)


def list_conversations(user_id) -> list:
    conversations = (
        AssistantConversation.query.filter_by(user_id=user_id)
        .order_by(AssistantConversation.is_pinned.desc(), AssistantConversation.last_message_at.desc())
        .all()
    )
    return [c.to_summary_dict() for c in conversations]


def get_conversation(conversation_id, user_id):
    return _find_owned(conversation_id, user_id)


def delete_conversation(conversation_id, user_id) -> bool:
    conversation = _find_owned(conversation_id, user_id)
    if not conversation:
        return False
    db.session.delete(conversation)
    db.session.commit()
    return True


def update_conversation(conversation_id, user_id, is_pinned: bool = None, is_favorite: bool = None, title: str = None):
    conversation = _find_owned(conversation_id, user_id)
    if not conversation:
        return None
    if is_pinned is not None:
        conversation.is_pinned = bool(is_pinned)
    if is_favorite is not None:
        conversation.is_favorite = bool(is_favorite)
    if title is not None and title.strip():
        conversation.title = title.strip()[:MAX_TITLE_LENGTH]
    db.session.commit()
    return conversation
