from flask import request

from utils.client_ip import get_client_ip


def ip_and_email_key() -> str:
    """Rate-limit key combining client IP with the target email in the request body.

    Plain per-IP keying means two genuinely different users behind the same network
    (same office/campus WiFi, same household, or the same mobile carrier's CGNAT —
    all common in practice) collide in one bucket: one account's lockout blocks
    every other account reachable from that IP. Scoping by (ip, email) instead keeps
    different accounts independent while still throttling repeated attempts against
    one target account, or one source cycling through many target emails.

    Falls back to IP alone if the body has no email (e.g. malformed JSON), which
    matches the previous, coarser behavior rather than failing the request.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    ip = get_client_ip()
    return f"{ip}:{email}" if email else ip
