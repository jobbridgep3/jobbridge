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


def send_verification_status_email(to: str, full_name: str, verified: bool, remarks: str | None = None):
    if verified:
        subject = "Your JobBridge profile has been verified"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Profile Verified</h2>
          <p>Hi {full_name}, your JobBridge profile has been verified by PESO Pila, Laguna.</p>
          <p>You can now fully use the platform, including applying to PESO-verified employer vacancies.</p>
        </div>
        """
    else:
        subject = "Action needed: Your JobBridge profile was not verified"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Profile Not Verified</h2>
          <p>Hi {full_name}, PESO staff reviewed your profile and could not verify it yet.</p>
          <p><b>Reason:</b> {remarks}</p>
          <p>Please log in to JobBridge, update or re-upload the information/documents noted above, and your profile will be reviewed again.</p>
        </div>
        """
    return send_email(to, subject, html)


def send_document_status_email(to: str, full_name: str, document_label: str, verified: bool, rejection_reason: str | None = None):
    if verified:
        subject = f"Your {document_label} has been verified"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Document Verified</h2>
          <p>Hi {full_name}, your <b>{document_label}</b> has been verified by PESO Pila, Laguna.</p>
        </div>
        """
    else:
        subject = f"Action needed: Your {document_label} was not verified"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Document Not Verified</h2>
          <p>Hi {full_name}, PESO staff reviewed your <b>{document_label}</b> and it was not verified.</p>
          <p><b>Reason:</b> {rejection_reason}</p>
          <p>Please log in to JobBridge and re-upload this document for review.</p>
        </div>
        """
    return send_email(to, subject, html)


def send_accreditation_status_email(to: str, company_name: str, approved: bool, remarks: str | None = None):
    if approved:
        dashboard_url = f"{current_app.config['FRONTEND_URL']}/employer/dashboard"
        subject = "Congratulations! Your company is now PESO-accredited"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Congratulations, {company_name}!</h2>
          <p>Your company has been successfully accredited by PESO Pila, Laguna.</p>
          <p>Your company can now create and submit job vacancies. You may now begin recruiting through JobBridge.</p>
          <p style="margin:24px 0">
            <a href="{dashboard_url}" style="background:#1e3a8a;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Go to Employer Dashboard</a>
          </p>
        </div>
        """
    else:
        subject = "Update on your company accreditation"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a8a">Accreditation Not Approved</h2>
          <p>PESO Pila, Laguna reviewed <b>{company_name}</b>'s accreditation request and it was not approved at this time.</p>
          <p><b>Reason:</b> {remarks}</p>
          <p>Please log in to JobBridge, update your Company Profile and documents as needed, and resubmit for review.</p>
        </div>
        """
    return send_email(to, subject, html)


def send_employer_welcome_email(to: str, company_name: str | None = None):
    display_name = company_name or "there"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1e3a8a">Welcome to JobBridge, {display_name}!</h2>
      <p>Your account has been successfully verified.</p>
      <p>Before you can post job vacancies, please:</p>
      <ol>
        <li>Complete your <b>Company Profile</b> (business details, address, representative).</li>
        <li>Upload your <b>required documents</b> (Business Permit, SEC/DTI/CDA Certificate, BIR Registration, Company Logo).</li>
        <li>Submit your profile and <b>wait for PESO/Admin accreditation</b>.</li>
      </ol>
      <p>Once accredited, you'll be able to post vacancies and start receiving applicants.</p>
    </div>
    """
    return send_email(to, "Welcome to JobBridge — Complete Your Company Profile", html)


def send_announcement_email(to: str, title: str, body: str):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#1e3a8a">{title}</h2>
      <div>{body}</div>
      <p style="color:#64748b;font-size:12px">— PESO Pila, Laguna via JobBridge</p>
    </div>
    """
    return send_email(to, f"PESO Announcement: {title}", html)
