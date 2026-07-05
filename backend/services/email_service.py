import logging
import threading

from flask import current_app
from flask_mail import Message

from extensions import mail

logger = logging.getLogger(__name__)


def _send_in_background(app, to: str, subject: str, html_body: str):
    with app.app_context():
        try:
            msg = Message(subject=subject, recipients=[to], html=html_body)
            mail.send(msg)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to send email to %s: %s", to, exc)


def send_email(to: str, subject: str, html_body: str):
    """Queues a real Gmail SMTP send via Flask-Mail on a background thread.

    Flask-Mail/smtplib has no send timeout, so a slow or blocked SMTP connection
    would otherwise hang the whole HTTP request (seen as registration/login
    endpoints stalling for a minute+). Sending happens off-thread so callers
    (register, staff invites, announcements, etc.) never wait on it.
    """
    app = current_app._get_current_object()
    threading.Thread(target=_send_in_background, args=(app, to, subject, html_body), daemon=True).start()
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
