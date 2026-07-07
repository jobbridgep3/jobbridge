"""Government-style PDF generation via WeasyPrint. Fully real, no external credentials needed.

WeasyPrint requires native GTK/Pango/Cairo libraries that aren't present on a bare Windows
dev machine by default (they are present on Render/Linux deploys). Import is deferred into
each function so the rest of the API keeps working locally even if those libs are missing;
only the PDF-generating endpoints themselves would fail until the libs are installed.
"""

import io
import logging

logger = logging.getLogger(__name__)

BASE_STYLE = """
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; }
  .letterhead { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; }
  .letterhead h1 { color: #1e3a8a; margin: 0; font-size: 20px; }
  .letterhead p { margin: 4px 0 0; color: #475569; font-size: 12px; }
  .content { font-size: 14px; line-height: 1.7; }
  .signature { margin-top: 60px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f1f5f9; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
</style>
"""

LETTERHEAD = """
<div class="letterhead">
  <h1>PUBLIC EMPLOYMENT SERVICE OFFICE — PILA, LAGUNA</h1>
  <p>Municipal Hall, Pila, Laguna | jobbridgepilalaguna@gmail.com</p>
</div>
"""


def _render(body_html: str) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        logger.error("WeasyPrint native libraries unavailable: %s", exc)
        raise RuntimeError(
            "PDF generation is unavailable — WeasyPrint's native GTK/Pango/Cairo libraries "
            "are not installed on this machine. This works out of the box on the Render deploy; "
            "for local Windows dev, install the GTK3 runtime (see WeasyPrint docs) to enable it."
        ) from exc
    html = f"<html><head>{BASE_STYLE}</head><body>{LETTERHEAD}<div class='content'>{body_html}</div></body></html>"
    return HTML(string=html).write_pdf()


def generate_referral_letter(jobseeker_name: str, job_title: str, company_name: str, date_str: str) -> bytes:
    body = f"""
    <p>Date: {date_str}</p>
    <p>TO WHOM IT MAY CONCERN:</p>
    <p>This is to certify that <b>{jobseeker_name}</b> is a registered jobseeker at the Public Employment
    Service Office (PESO) of Pila, Laguna, and is being referred for the position of
    <b>{job_title}</b> at <b>{company_name}</b>.</p>
    <p>We hope you will give favorable consideration to the bearer of this letter.</p>
    <div class="signature">
      <p>Very truly yours,</p>
      <br/><br/>
      <p>___________________________<br/>PESO Manager</p>
    </div>
    """
    return _render(body)


def generate_certificate(jobseeker_name: str, program_title: str, date_str: str) -> bytes:
    body = f"""
    <div style="text-align:center;margin-top:60px">
      <p style="font-size:16px">This is to certify that</p>
      <h2 style="color:#1e3a8a">{jobseeker_name}</h2>
      <p style="font-size:16px">has successfully completed</p>
      <h3>{program_title}</h3>
      <p>Issued on {date_str}</p>
    </div>
    """
    return _render(body)


def generate_table_report(title: str, columns: list[str], rows: list[list], date_str: str) -> bytes:
    header = "".join(f"<th>{c}</th>" for c in columns)
    body_rows = "".join("<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows)
    body = f"""
    <h2>{title}</h2>
    <p>Generated: {date_str}</p>
    <table><thead><tr>{header}</tr></thead><tbody>{body_rows}</tbody></table>
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body)


def generate_profile_report(profile: dict, documents: list[dict]) -> bytes:
    """Comprehensive Job Seeker application profile, for the jobseeker's own download.

    Takes plain dicts (JobseekerProfile.to_dict() output), not ORM objects, matching the
    rest of this module's convention of staying decoupled from the ORM. Text-only —
    deliberately doesn't embed the profile picture or document images, which would add a
    live Supabase-URL fetch dependency to PDF rendering (none of the existing generators
    here do that either).
    """
    from models.jobseeker import DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES

    def row(label, value):
        return f"<tr><th style='width:220px'>{label}</th><td>{value or '—'}</td></tr>"

    personal_rows = "".join([
        row("Full Name", profile.get("full_name")),
        row("Email", profile.get("email")),
        row("Contact Number", profile.get("contact_number")),
        row("Date of Birth", profile.get("date_of_birth")),
        row("Age", profile.get("age")),
        row("Gender", profile.get("gender")),
        row("Civil Status", profile.get("civil_status")),
        row("Nationality", profile.get("nationality")),
        row("Address", profile.get("address")),
    ])

    employment_rows = "".join([
        row("Employment Status", profile.get("employment_status")),
        row("Preferred Job Position", profile.get("preferred_job_position")),
        row("Preferred Industry", profile.get("preferred_industry")),
        row("Preferred Work Location", profile.get("preferred_work_location")),
        row("Expected Salary", profile.get("expected_salary")),
        row("Employment Type", profile.get("employment_type")),
    ])

    education_rows = "".join(
        f"<tr><td>{e['school']}</td><td>{e.get('attainment_level') or ''}</td>"
        f"<td>{e.get('degree') or 'N/A'}</td><td>{e.get('graduation_year') or ''}</td>"
        f"<td>{e.get('honors') or ''}</td></tr>"
        for e in profile.get("educations", [])
    ) or "<tr><td colspan='5'>No education records provided.</td></tr>"

    work_rows = "".join(
        f"<tr><td>{w['company']}</td><td>{w['position']}</td>"
        f"<td>{w.get('start_date') or ''} – {w.get('end_date') or 'present'}</td></tr>"
        for w in profile.get("work_experiences", [])
    ) or "<tr><td colspan='3'>No work experience provided.</td></tr>"

    def skill_line(label, key):
        values = profile.get(key) or []
        return f"<p><b>{label}:</b> {', '.join(values) if values else '—'}</p>"

    doc_types_present = {d["document_type"] for d in documents}
    doc_rows = ""
    for doc_type, label in DOCUMENT_TYPE_LABELS.items():
        matching = [d for d in documents if d["document_type"] == doc_type]
        required = doc_type in REQUIRED_DOCUMENT_TYPES
        status = f"Uploaded ({len(matching)})" if matching else ("Missing" if required else "Not provided")
        doc_rows += f"<tr><td>{label}{' (Required)' if required else ''}</td><td>{status}</td></tr>"
    resume_status = "Uploaded" if profile.get("resume_url") else "Missing"
    doc_rows = f"<tr><td>Resume/CV (Required)</td><td>{resume_status}</td></tr>" + doc_rows

    body = f"""
    <h2>Job Seeker Application Profile</h2>
    <p>Profile Completion: <b>{profile.get('profile_completion', 0)}%</b></p>

    <h3>Personal Information</h3>
    <table>{personal_rows}</table>

    <h3>Employment Information</h3>
    <table>{employment_rows}</table>

    <h3>Work Experience</h3>
    <table><thead><tr><th>Company</th><th>Position</th><th>Duration</th></tr></thead><tbody>{work_rows}</tbody></table>

    <h3>Educational Background</h3>
    <table><thead><tr><th>School</th><th>Attainment</th><th>Course/Program</th><th>Year</th><th>Honors</th></tr></thead>
    <tbody>{education_rows}</tbody></table>

    <h3>Skills</h3>
    {skill_line("Technical Skills", "technical_skills")}
    {skill_line("Soft Skills", "soft_skills")}
    {skill_line("Languages Spoken", "languages_spoken")}
    {skill_line("Certifications", "certifications")}

    <h3>Documents</h3>
    <table><thead><tr><th>Document</th><th>Status</th></tr></thead><tbody>{doc_rows}</tbody></table>
    """
    return _render(body)


def to_bytesio(pdf_bytes: bytes) -> io.BytesIO:
    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf
