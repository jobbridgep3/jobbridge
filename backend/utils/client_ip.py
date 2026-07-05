from flask import request


def get_client_ip() -> str:
    """Resolve the real visitor IP, trusting Cloudflare over guessed proxy hop counts.

    Render fronts every app with Cloudflare, then its own internal router, before
    reaching gunicorn — X-Forwarded-For arrives as "client, cloudflare_ip, render_ip"
    (confirmed by inspecting recorded audit_trail rows). Counting a fixed number of
    hops from the right (via werkzeug's ProxyFix x_for) is brittle if that chain
    length ever changes, and previously left every user sharing Render's internal
    router IP, which made one user's rate limit trigger 429s for everyone.

    CF-Connecting-IP is set by Cloudflare itself from the actual TCP connection it
    terminates, and Cloudflare overwrites any client-supplied value for its own
    header, so it can't be spoofed by the request itself. Fall back to
    request.remote_addr (via ProxyFix) for non-Cloudflare environments, e.g. local dev.
    """
    return request.headers.get("CF-Connecting-IP") or request.remote_addr or "unknown"
