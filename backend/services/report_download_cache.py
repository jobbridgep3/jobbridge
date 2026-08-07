"""In-memory, short-TTL cache for AI-assistant-generated report files awaiting download.

Deliberately NOT persisted to Supabase Storage or any DB table — a "click this in the
next few minutes" convenience link doesn't need to survive a backend restart, and
Supabase Storage has no signed-URL precedent anywhere in this codebase (storage_service.py
only ever does permanent, unauthenticated get_public_url) — building that would be new
integration work for marginal benefit here. Known, disclosed tradeoff: this cache is
lost on a process restart (e.g. Render free-tier idle spin-down).

The actual security boundary is blueprints/assistant.py's download route checking the
requester's JWT identity against the token's recorded owner — this cache's token is an
opaque lookup key, not itself a credential. sweep_expired() is called periodically by
scheduler.py so expired entries don't sit in memory indefinitely.
"""

import logging
import secrets
import time

logger = logging.getLogger(__name__)

_TTL_SECONDS = 15 * 60
_cache = {}


def stage(file_bytes: bytes, filename: str, mimetype: str, owner_user_id) -> str:
    token = secrets.token_urlsafe(24)
    _cache[token] = {
        "bytes": file_bytes,
        "filename": filename,
        "mimetype": mimetype,
        "owner_user_id": str(owner_user_id),
        "expires_at": time.time() + _TTL_SECONDS,
    }
    return token


def retrieve(token: str, requester_user_id) -> dict | None:
    """Returns the cache entry if it exists, hasn't expired, and belongs to the
    requester — else None. Doesn't delete on read, since a user reloading the chat and
    clicking the same link again within the TTL window is normal, expected behavior."""
    entry = _cache.get(token)
    if not entry:
        return None
    if time.time() > entry["expires_at"]:
        _cache.pop(token, None)
        return None
    if entry["owner_user_id"] != str(requester_user_id):
        return None
    return entry


def sweep_expired() -> int:
    now = time.time()
    expired = [token for token, entry in _cache.items() if now > entry["expires_at"]]
    for token in expired:
        _cache.pop(token, None)
    if expired:
        logger.info("Swept %d expired generated-report cache entries.", len(expired))
    return len(expired)
