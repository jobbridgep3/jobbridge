import logging
import threading

import requests
from flask import current_app

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _send_via_brevo(api_key: str, sender_name: str, sender_email: str, to: str, subject: str, html_body: str):
    try:
        resp = requests.post(
            BREVO_API_URL,
            headers={"api-key": api_key, "accept": "application/json", "content-type": "application/json"},
            json={
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html_body,
            },
            timeout=15,
        )
        if resp.status_code >= 300:
            logger.error("Brevo email send to %s failed: %s %s", to, resp.status_code, resp.text)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send email to %s: %s", to, exc)


def send_email(to: str, subject: str, html_body: str):
    """Queues a transactional email via Brevo's HTTP API on a background thread.

    Brevo's API (vs. Gmail SMTP) avoids cloud-host SMTP port blocking/throttling,
    which was causing OTP emails to hang the request or never arrive at all.
    Sending happens off-thread so callers (register, staff invites, announcements,
    etc.) never wait on the network call.
    """
    cfg = current_app.config
    threading.Thread(
        target=_send_via_brevo,
        args=(cfg["BREVO_API_KEY"], cfg["BREVO_SENDER_NAME"], cfg["BREVO_SENDER_EMAIL"], to, subject, html_body),
        daemon=True,
    ).start()
    return True


def send_otp_email(to: str, code: str, purpose: str = "register"):
    action = "verify your account" if purpose == "register" else "reset your password"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a8a">JobBridge — PESO Pila, Laguna</h2>
      <p>Use the code below to {action}:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e3a8a">{code}</p>
      <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
    </div>
    """
    return send_email(to, "Your JobBridge verification code", html)


def send_staff_credentials_email(to: str, full_name: str, temp_password: str):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a8a">Welcome to JobBridge, {full_name}</h2>
      <p>An Admin has created a PESO Staff account for you.</p>
      <p><b>Email:</b> {to}<br/><b>Temporary password:</b> {temp_password}</p>
      <p>Please log in and change your password immediately.</p>
    </div>
    """
    return send_email(to, "Your JobBridge PESO Staff account", html)


def send_interview_invite_email(to: str, job_title: str, company_name: str, when: str, mode: str, location: str):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a8a">Interview Invitation</h2>
      <p><b>{company_name}</b> has invited you to an interview for <b>{job_title}</b>.</p>
      <p><b>When:</b> {when}<br/><b>Mode:</b> {mode}<br/><b>Location/Link:</b> {location}</p>
      <p>Log in to JobBridge to accept or decline this invitation.</p>
    </div>
    """
    return send_email(to, f"Interview Invitation — {job_title}", html)


def send_announcement_email(to: str, title: str, body: str):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#1e3a8a">{title}</h2>
      <div>{body}</div>
      <p style="color:#64748b;font-size:12px">— PESO Pila, Laguna via JobBridge</p>
    </div>
    """
    return send_email(to, f"PESO Announcement: {title}", html)
