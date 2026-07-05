import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def verify_recaptcha(token: str, remote_ip: str = None) -> bool:
    """Verifies a reCAPTCHA v2 token against Google's siteverify API.

    Fails closed: a missing token, missing server config, a network error talking to
    Google, or an unsuccessful response are all treated as "not verified" rather than
    silently letting the request through — this gate exists specifically to stop
    automated login attempts, so an error case must not become a bypass.
    """
    if not token:
        return False

    secret = current_app.config.get("RECAPTCHA_SECRET_KEY")
    if not secret:
        logger.error("RECAPTCHA_SECRET_KEY is not configured; rejecting reCAPTCHA verification.")
        return False

    payload = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        resp = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=10)
        result = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("reCAPTCHA verification request failed: %s", exc)
        return False

    if not result.get("success"):
        logger.info("reCAPTCHA verification failed: %s", result.get("error-codes"))
    return bool(result.get("success"))
