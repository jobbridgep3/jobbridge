"""Government-style PDF generation via WeasyPrint. Fully real, no external credentials needed.

WeasyPrint requires native GTK/Pango/Cairo libraries that aren't present on a bare Windows
dev machine by default (they are present on Render/Linux deploys). Import is deferred into
each function so the rest of the API keeps working locally even if those libs are missing;
only the PDF-generating endpoints themselves would fail until the libs are installed.
"""

import html
import io
import logging

logger = logging.getLogger(__name__)


def _esc(value) -> str:
    """Escapes a value for safe HTML interpolation — user-supplied text (names,
    company names, remarks, etc.) is interpolated into these templates via f-strings,
    so a stray '<' or '&' could otherwise corrupt the table structure of the
    rendered PDF."""
    return html.escape(str(value)) if value is not None else ""


def _val(value, placeholder: str = "Not provided") -> str:
    """One consistent placeholder convention for a possibly-empty field — replaces
    the previous three different ad hoc styles ('—', 'N/A', bare empty string)."""
    if value is None or value == "" or value == []:
        return placeholder
    return _esc(value)


BASE_STYLE = """
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 40px; }
  @page {
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #94a3b8; }
  }
  .letterhead { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; }
  .letterhead h1 { color: #1e3a8a; margin: 0; font-size: 20px; }
  .letterhead p { margin: 4px 0 0; color: #475569; font-size: 12px; }
  .content { font-size: 14px; line-height: 1.7; }
  .signature { margin-top: 60px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
  th { background: #f1f5f9; }
  .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .bar-label { width: 160px; font-size: 11px; }
  .bar-track { flex: 1; background: #f1f5f9; height: 12px; border-radius: 6px; overflow: hidden; }
  .bar-fill { background: #1e3a8a; height: 12px; }
  .bar-value { width: 40px; font-size: 11px; text-align: right; }
</style>
"""

LETTERHEAD = """
<div class="letterhead">
  <h1>PUBLIC EMPLOYMENT SERVICE OFFICE — PILA, LAGUNA</h1>
  <p>Municipal Hall, Pila, Laguna | jobbridgepilalaguna@gmail.com</p>
</div>
"""


def _render(body_html: str, landscape: bool = False) -> bytes:
    try:
        from weasyprint import HTML
    except (ImportError, OSError) as exc:
        logger.error("WeasyPrint native libraries unavailable: %s", exc)
        raise RuntimeError(
            "PDF generation is unavailable — WeasyPrint's native GTK/Pango/Cairo libraries "
            "are not installed on this machine. This works out of the box on the Render deploy; "
            "for local Windows dev, install the GTK3 runtime (see WeasyPrint docs) to enable it."
        ) from exc
    # Optional wide-table override — every existing caller omits this and keeps the
    # default portrait page WeasyPrint applies when no @page size is set.
    landscape_style = "<style>@page { size: A4 landscape; }</style>" if landscape else ""
    html = f"<html><head>{BASE_STYLE}{landscape_style}</head><body>{LETTERHEAD}<div class='content'>{body_html}</div></body></html>"
    return HTML(string=html).write_pdf()


def generate_referral_letter(jobseeker_name: str, job_title: str | None, company_name: str | None, date_str: str) -> bytes:
    if job_title and company_name:
        referral_line = (
            f"and is being referred for the position of <b>{_esc(job_title)}</b> at <b>{_esc(company_name)}</b>."
        )
    else:
        referral_line = "and is hereby referred for employment to any suitable position with your good office."
    body = f"""
    <p>Date: {_esc(date_str)}</p>
    <p>TO WHOM IT MAY CONCERN:</p>
    <p>This is to certify that <b>{_esc(jobseeker_name)}</b> is a registered jobseeker at the Public Employment
    Service Office (PESO) of Pila, Laguna, {referral_line}</p>
    <p>We hope you will give favorable consideration to the bearer of this letter.</p>
    <div class="signature">
      <p>Very truly yours,</p>
      <br/><br/>
      <p>___________________________<br/>PESO Manager</p>
    </div>
    """
    return _render(body)


def generate_interview_invitation(
    jobseeker_name: str, job_title: str, company_name: str, when: str, mode: str,
    location: str | None, meeting_link: str | None, interviewer_name: str | None, date_str: str,
) -> bytes:
    detail_rows = f"""
    <tr><th style="width:180px">Position</th><td>{_esc(job_title)}</td></tr>
    <tr><th>Company</th><td>{_esc(company_name)}</td></tr>
    <tr><th>Date &amp; Time</th><td>{_esc(when)}</td></tr>
    <tr><th>Interview Type</th><td>{_esc(mode.title() if mode else mode)}</td></tr>
    <tr><th>Venue</th><td>{_val(location)}</td></tr>
    <tr><th>Meeting Link</th><td>{_val(meeting_link)}</td></tr>
    <tr><th>Interviewer</th><td>{_val(interviewer_name, "To be announced")}</td></tr>
    """
    body = f"""
    <p>Date issued: {_esc(date_str)}</p>
    <h2 style="color:#1e3a8a">Interview Invitation</h2>
    <p>Dear <b>{_esc(jobseeker_name)}</b>,</p>
    <p><b>{_esc(company_name)}</b> has invited you to an interview for the position of
    <b>{_esc(job_title)}</b>. The interview details are as follows:</p>
    <table>{detail_rows}</table>
    <p style="margin-top:16px">Please arrive on time and bring a valid ID and copies of your resume.
    You may accept, decline, or request a reschedule of this interview through your JobBridge account.</p>
    <div class="footer">JobBridge — PESO Pila, Laguna | This invitation was generated by the JobBridge system.</div>
    """
    return _render(body)


def generate_job_offer(
    jobseeker_name: str, position: str, company_name: str, salary: str | None,
    employment_type: str | None, start_date: str | None, terms: str | None, date_str: str,
) -> bytes:
    detail_rows = f"""
    <tr><th style="width:180px">Position</th><td>{_esc(position)}</td></tr>
    <tr><th>Company</th><td>{_esc(company_name)}</td></tr>
    <tr><th>Salary Offer</th><td>{_val(salary, "As discussed")}</td></tr>
    <tr><th>Employment Type</th><td>{_val(employment_type)}</td></tr>
    <tr><th>Expected Start Date</th><td>{_val(start_date, "To be arranged")}</td></tr>
    """
    body = f"""
    <p>Date issued: {_esc(date_str)}</p>
    <h2 style="color:#1e3a8a">Job Offer</h2>
    <p>Dear <b>{_esc(jobseeker_name)}</b>,</p>
    <p>We are pleased to inform you that <b>{_esc(company_name)}</b> is extending you an offer of
    employment for the position of <b>{_esc(position)}</b>, with the following terms:</p>
    <table>{detail_rows}</table>
    {f"<p style='margin-top:16px'><b>Additional terms:</b><br/>{_esc(terms)}</p>" if terms else ""}
    <p style="margin-top:16px">You may accept or decline this offer through your JobBridge account.
    This offer letter was generated by the JobBridge system on behalf of the employer.</p>
    <div class="signature">
      <p>Sincerely,</p>
      <br/><br/>
      <p>___________________________<br/>{_esc(company_name)}</p>
    </div>
    """
    return _render(body)


def generate_jobfair_registration_form(
    profile: dict, fair: dict, registration_number: str, qr_data_url: str, date_str: str,
) -> bytes:
    """Official job fair registration form: applicant info, registration number,
    event details, and the attendance QR code (rendered from a data URL)."""
    applicant_rows = f"""
    <tr><th style="width:200px">Full Name</th><td>{_val(profile.get("full_name"))}</td></tr>
    <tr><th>Contact Number</th><td>{_val(profile.get("contact_number"))}</td></tr>
    <tr><th>Address</th><td>{_val(", ".join(filter(None, [profile.get("barangay"), profile.get("municipality"), profile.get("province")])))}</td></tr>
    <tr><th>Preferred Position</th><td>{_val(profile.get("preferred_job_position"))}</td></tr>
    """
    event_rows = f"""
    <tr><th style="width:200px">Event</th><td>{_esc(fair.get("name"))}</td></tr>
    <tr><th>Date &amp; Time</th><td>{_val(fair.get("event_date_str"))}</td></tr>
    <tr><th>Venue</th><td>{_val(fair.get("venue"))}</td></tr>
    <tr><th>Contact Person</th><td>{_val(fair.get("contact_person"))}</td></tr>
    <tr><th>Requirements</th><td>{_val(fair.get("requirements"), "None specified")}</td></tr>
    """
    body = f"""
    <p>Date issued: {_esc(date_str)}</p>
    <h2 style="color:#1e3a8a">Job Fair Registration Form</h2>
    <p style="font-size:16px"><b>Registration No.:</b>
    <span style="color:#1e3a8a;font-weight:bold">{_esc(registration_number)}</span></p>
    <h3>Applicant Information</h3>
    <table>{applicant_rows}</table>
    <h3 style="margin-top:20px">Event Details</h3>
    <table>{event_rows}</table>
    <div style="text-align:center;margin-top:24px">
      <p><b>Present this QR code at the venue for attendance:</b></p>
      <img src="{qr_data_url}" alt="QR Code" width="170" height="170"/>
    </div>
    <div class="footer">JobBridge — PESO Pila, Laguna | Bring this form and a valid ID to the event.</div>
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


def generate_table_report(
    title: str, columns: list[str], rows: list[list], date_str: str,
    landscape: bool = False, subtitle_lines: list[str] | None = None,
) -> bytes:
    header = "".join(f"<th>{_esc(c)}</th>" for c in columns)
    body_rows = "".join("<tr>" + "".join(f"<td>{_val(cell)}</td>" for cell in row) + "</tr>" for row in rows)
    subtitle_html = "".join(f"<p>{_esc(s)}</p>" for s in (subtitle_lines or []))
    body = f"""
    <h2>{_esc(title)}</h2>
    {subtitle_html}
    <p>Generated: {_esc(date_str)}</p>
    <table><thead><tr>{header}</tr></thead><tbody>{body_rows}</tbody></table>
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body, landscape=landscape)


def generate_profile_report(profile: dict, documents: list[dict]) -> bytes:
    """Comprehensive Job Seeker application profile, for the jobseeker's own download.

    Takes plain dicts (JobseekerProfile.to_dict() output), not ORM objects, matching the
    rest of this module's convention of staying decoupled from the ORM. Text-only —
    deliberately doesn't embed the profile picture, which would add a live Supabase-URL
    fetch dependency to PDF rendering (a documented, intentional constraint, not an
    oversight — see backend blueprints/profile.py for the same reasoning applied
    elsewhere). The verification QR code below is generated locally instead (no fetch).
    """
    from datetime import datetime

    from models.jobseeker import DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENT_TYPES
    from services.qr_service import generate_qr_data_url

    generated_at = datetime.utcnow().strftime("%B %d, %Y %I:%M %p UTC")
    qr_src = generate_qr_data_url(f"JobBridge Profile Verification | ID: {profile.get('id')} | Generated: {generated_at}")

    def row(label, value):
        return f"<tr><th style='width:220px'>{_esc(label)}</th><td>{_val(value)}</td></tr>"

    personal_rows = "".join([
        row("Full Name", profile.get("full_name")),
        row("Email", profile.get("email")),
        row("Contact Number", profile.get("contact_number")),
        row("Date of Birth", profile.get("date_of_birth")),
        row("Age", profile.get("age")),
        row("Gender", profile.get("gender")),
        row("Civil Status", profile.get("civil_status")),
        row("Nationality", profile.get("nationality")),
        row("Complete Address", profile.get("address")),
    ])

    education_rows = "".join(
        f"<tr><td>{_val(e.get('attainment_level'))}</td><td>{_esc(e['school'])}</td>"
        f"<td>{_val(e.get('degree'))}</td><td>{_val(e.get('graduation_year'))}</td>"
        f"<td>{_val(e.get('honors'))}</td></tr>"
        for e in profile.get("educations", [])
    ) or "<tr><td colspan='5'>No education records provided.</td></tr>"

    employment_rows = "".join([
        row("Employment Status", profile.get("employment_status")),
        row("Preferred Job Position", profile.get("preferred_job_position")),
        row("Preferred Industry", profile.get("preferred_industry")),
        row("Preferred Work Location", profile.get("preferred_work_location")),
        row("Employment Type", profile.get("employment_type")),
        row("Expected Salary", profile.get("expected_salary")),
    ])

    def skill_line(label, key):
        values = profile.get(key) or []
        return f"<p><b>{_esc(label)}:</b> {_esc(', '.join(values)) if values else 'Not provided'}</p>"

    # Chronological: most recent first (falls back to end of list if no start_date).
    work_experiences = sorted(
        profile.get("work_experiences", []),
        key=lambda w: w.get("start_date") or "",
        reverse=True,
    )
    work_rows = "".join(
        f"<tr><td>{_esc(w['company'])}</td><td>{_esc(w['position'])}</td>"
        f"<td>{_val(w.get('start_date'))} – {w.get('end_date') or 'Present'}</td>"
        f"<td>{_val(w.get('description'))}</td></tr>"
        for w in work_experiences
    ) or "<tr><td colspan='4'>No work experience provided.</td></tr>"

    doc_rows = ""
    resume_ok = bool(profile.get("resume_url"))
    doc_rows += f"<tr><td>{'✓' if resume_ok else '✗'} Resume/CV {'Uploaded' if resume_ok else 'Not Uploaded'} (Required)</td></tr>"
    for doc_type, label in DOCUMENT_TYPE_LABELS.items():
        matching = [d for d in documents if d["document_type"] == doc_type]
        required = doc_type in REQUIRED_DOCUMENT_TYPES
        mark = "✓" if matching else "✗"
        state = "Uploaded" if matching else "Not Uploaded"
        doc_rows += f"<tr><td>{mark} {_esc(label)} {state}{' (Required)' if required else ''}</td></tr>"

    body = f"""
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h2 style="margin-bottom:0">Job Seeker Application Profile</h2>
        <p style="margin-top:4px;color:#475569">Generated: {generated_at}</p>
        <p>Profile Completion: <b>{profile.get('profile_completion', 0)}%</b></p>
      </div>
      <img src="{qr_src}" style="width:80px;height:80px" alt="Verification QR code" />
    </div>

    <h3>Personal Information</h3>
    <table>{personal_rows}</table>

    <h3>Educational Background</h3>
    <table><thead><tr><th>Highest Attainment</th><th>School Name</th><th>Course/Program</th><th>Year Graduated</th><th>Honors</th></tr></thead>
    <tbody>{education_rows}</tbody></table>

    <h3>Employment Information</h3>
    <table>{employment_rows}</table>

    <h3>Skills</h3>
    {skill_line("Technical Skills", "technical_skills")}
    {skill_line("Soft Skills", "soft_skills")}
    {skill_line("Languages Spoken", "languages_spoken")}
    {skill_line("Certifications", "certifications")}

    <h3>Work Experience</h3>
    <table><thead><tr><th>Company Name</th><th>Position</th><th>Employment Dates</th><th>Job Description</th></tr></thead><tbody>{work_rows}</tbody></table>

    <h3>Uploaded Documents</h3>
    <table>{doc_rows}</table>

    <div class="footer">Generated by JobBridge System — PESO Pila, Laguna | {generated_at}</div>
    """
    return _render(body)


def generate_owwa_application_form(request_dict: dict, profile_dict: dict, email: str) -> bytes:
    """Official OWWA Assistance Program Application Form, auto-generated on submission
    (see blueprints/owwa.py::apply_owwa_request) so the jobseeker never has to upload
    one themselves. Same plain-dict convention as generate_profile_report — takes
    OwwaRequest.to_dict()/JobseekerProfile.to_dict() output, not ORM objects."""
    generated_at = _val(request_dict.get("submitted_at"), "Not provided")

    def row(label, value):
        return f"<tr><th style='width:220px'>{_esc(label)}</th><td>{_val(value)}</td></tr>"

    reference_rows = "".join([
        row("Application Reference Number", request_dict.get("id")),
        row("Date Submitted", generated_at),
        row("Application Status", (request_dict.get("status") or "").replace("_", " ").title()),
    ])

    applicant_rows = "".join([
        row("Full Name", profile_dict.get("full_name")),
        row("Date of Birth", profile_dict.get("date_of_birth")),
        row("Age", profile_dict.get("age")),
        row("Gender", profile_dict.get("gender")),
        row("Civil Status", profile_dict.get("civil_status")),
        row("Nationality", profile_dict.get("nationality")),
        row("Contact Number", profile_dict.get("contact_number")),
        row("Email Address", email),
        row("Complete Address", profile_dict.get("address")),
        row("Barangay", profile_dict.get("barangay")),
        row("Municipality", profile_dict.get("municipality")),
        row("Province", profile_dict.get("province")),
    ])

    owwa_rows = "".join([
        row("OFW Status / Relationship to OFW", request_dict.get("ofw_relationship")),
        row("Supporting Details", request_dict.get("notes")),
    ])

    body = f"""
    <h2 style="color:#1e3a8a;text-align:center">OWWA ASSISTANCE PROGRAM — APPLICATION FORM</h2>
    <p style="text-align:center;color:#64748b;font-size:11px">Generated via JobBridge — Public Employment Service Office, Pila, Laguna</p>

    <h3>Reference Information</h3>
    <table>{reference_rows}</table>

    <h3>Applicant Information</h3>
    <table>{applicant_rows}</table>

    <h3>OWWA Information</h3>
    <table>{owwa_rows}</table>

    <div class="footer">This form was auto-generated by JobBridge from the applicant's PESO profile and OWWA Assistance request. For offline submission to OWWA Region IV-A.</div>
    """
    return _render(body)


def _bar_list(items: list[dict], label_key: str, value_key: str) -> str:
    """Renders a single-series list as simple CSS bar visuals — WeasyPrint rasterizes
    plain HTML/CSS box widths natively, so this needs no chart-image library."""
    if not items:
        return "<p>No data available.</p>"
    max_value = max((item[value_key] for item in items), default=0) or 1
    rows = []
    for item in items:
        pct = round(item[value_key] / max_value * 100)
        rows.append(
            f"<div class='bar-row'><span class='bar-label'>{_esc(item[label_key])}</span>"
            f"<span class='bar-track'><span class='bar-fill' style='width:{pct}%'></span></span>"
            f"<span class='bar-value'>{item[value_key]}</span></div>"
        )
    return "".join(rows)


def _series_table(items: list[dict], columns: list[tuple[str, str]]) -> str:
    """columns: list of (dict_key, header_label)."""
    if not items:
        return "<p>No data available.</p>"
    header = "".join(f"<th>{_esc(h)}</th>" for _, h in columns)
    body_rows = "".join(
        "<tr>" + "".join(f"<td>{_val(item.get(k))}</td>" for k, _ in columns) + "</tr>" for item in items
    )
    return f"<table><thead><tr>{header}</tr></thead><tbody>{body_rows}</tbody></table>"


def generate_dashboard_report(summary: dict | None, analytics: dict | None, date_str: str, generated_by: str) -> bytes:
    """Dashboard export PDF — summary stat cards and/or analytics series, per the
    `scope` requested by the caller. Charts render as data tables (multi-series) or
    simple CSS bar visuals (single-series: job categories, top skills) rather than
    real chart images, consistent with this module's existing WeasyPrint-HTML-only
    approach (no matplotlib/plotly dependency)."""
    sections = []

    if summary:
        summary_labels = {
            "total_jobseekers": "Total Jobseekers", "active_employers": "Active Employers",
            "active_vacancies": "Active Vacancies", "total_applications": "Total Applications",
            "successful_placements": "Successful Placements", "placements_this_month": "Placements This Month",
            "placement_success_rate": "Placement Success Rate (%)", "employment_rate": "Employment Rate (%)",
            "pending_verifications": "Pending Verifications", "new_registrations_this_month": "New Registrations This Month",
        }
        rows = "".join(
            f"<tr><th style='width:280px'>{_esc(summary_labels.get(k, k))}</th><td>{_val(v)}</td></tr>"
            for k, v in summary.items()
        )
        sections.append(f"<h3>Summary</h3><table>{rows}</table>")

    if analytics:
        sections.append("<h3>Monthly Registrations</h3>" + _series_table(
            analytics.get("monthly_registrations", []), [("month", "Month"), ("jobseekers", "Jobseekers"), ("employers", "Employers")]))
        sections.append("<h3>Monthly Applications</h3>" + _series_table(
            analytics.get("monthly_applications", []), [("month", "Month"), ("count", "Applications")]))
        sections.append("<h3>Employment Trends</h3>" + _series_table(
            analytics.get("employment_trends", []), [("month", "Month"), ("placements", "Placements")]))
        sections.append("<h3>Hiring Funnel</h3>" + _series_table(
            analytics.get("hiring_funnel", []), [("status", "Status"), ("count", "Applications")]))
        sections.append("<h3>Job Category Distribution</h3>" + _bar_list(
            analytics.get("job_category_distribution", []), "category", "count"))
        sections.append("<h3>Top Skills in Demand</h3>" + _bar_list(
            analytics.get("top_skills", []), "skill", "count"))

    body = f"""
    <h2>Dashboard Analytics Report</h2>
    <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)}</p>
    {''.join(sections)}
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body)


def generate_employer_dashboard_report(summary: dict | None, analytics: dict | None, company_name: str, date_str: str, generated_by: str) -> bytes:
    """Employer-scoped counterpart to generate_dashboard_report — same table/bar
    rendering helpers, different section set/labels (this employer's own vacancies
    and applicants, not platform-wide jobseeker/employer registration figures)."""
    sections = []

    if summary:
        summary_labels = {
            "active_vacancies": "Active Vacancies", "total_applicants": "Total Applicants",
            "new_applicants_today": "New Applicants Today", "scheduled_interviews": "Scheduled Interviews",
            "hired_applicants": "Hired Applicants", "pending_vacancies": "Pending Vacancies",
            "closed_vacancies": "Closed Vacancies", "company_profile_completion": "Company Profile Completion (%)",
            "accreditation_status": "Accreditation Status",
        }
        rows = "".join(
            f"<tr><th style='width:280px'>{_esc(summary_labels.get(k, k))}</th><td>{_val(v)}</td></tr>"
            for k, v in summary.items()
        )
        sections.append(f"<h3>Summary</h3><table>{rows}</table>")

    if analytics:
        sections.append("<h3>Applications per Vacancy</h3>" + _bar_list(
            analytics.get("applications_per_vacancy", []), "vacancy", "count"))
        sections.append("<h3>Applicant Status</h3>" + _series_table(
            analytics.get("applicant_status", []), [("status", "Status"), ("count", "Count")]))
        sections.append("<h3>Monthly Applications</h3>" + _series_table(
            analytics.get("monthly_applications", []), [("month", "Month"), ("count", "Applications")]))
        sections.append("<h3>Hiring Funnel</h3>" + _series_table(
            analytics.get("hiring_funnel", []), [("stage", "Stage"), ("count", "Count")]))

    body = f"""
    <h2>{_esc(company_name)} — Dashboard Report</h2>
    <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)}</p>
    {''.join(sections)}
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body)


MANPOWER_STAT_LABELS = {
    "total_applications": "Total Applications", "pending": "Pending",
    "pooled": "Pooled (Approved)", "submitted_to_tesda": "Submitted to TESDA",
    "for_tesda_response": "Awaiting TESDA Response", "completed": "Completed Training",
    "declined": "Declined", "active_batches": "Active Batches",
    "full_batches": "Full Batches", "available_slots": "Available Training Slots",
}


def generate_manpower_report(
    stats: dict, application_rows: list[dict], batch_rows: list[dict], date_str: str, generated_by: str, generated_role: str,
) -> bytes:
    """ManPower Skills Management report — KPI summary + Applications + Batches
    detail tables, same summary/section shape as generate_dashboard_report, reusing
    the same table-rendering helper. Rendered landscape since the Batches table has
    8 columns."""
    summary_rows = "".join(
        f"<tr><th style='width:280px'>{_esc(MANPOWER_STAT_LABELS.get(k, k))}</th><td>{_val(v)}</td></tr>"
        for k, v in stats.items()
    )

    application_columns = [
        ("jobseeker_name", "Applicant"), ("email", "Email"), ("program_interest", "Program Interest"),
        ("batch_name", "Batch"), ("status", "Status"), ("application_date", "Application Date"), ("remarks", "Remarks"),
    ]
    batch_columns = [
        ("batch_name", "Batch"), ("status", "Status"), ("min_pax", "Min Pax"), ("max_pax", "Max Pax"),
        ("current_pax", "Current Pax"), ("slots_remaining", "Slots Remaining"),
        ("submitted_to_tesda_date", "Submitted to TESDA"), ("tesda_response_date", "TESDA Response"),
    ]

    body = f"""
    <h2>ManPower Skills Management Report</h2>
    <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)} ({_esc(generated_role)})</p>
    <h3>Summary</h3>
    <table>{summary_rows}</table>
    <h3>Applications ({len(application_rows)})</h3>
    {_series_table(application_rows, application_columns)}
    <h3>Batches ({len(batch_rows)})</h3>
    {_series_table(batch_rows, batch_columns)}
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body, landscape=True)


OWWA_STAT_LABELS = {
    "total_requests": "Total Requests", "pending": "Pending", "verified": "Verified",
    "submitted_to_owwa": "Submitted to OWWA", "for_owwa_response": "Awaiting OWWA Response",
    "in_progress": "In Progress (Verified/Submitted/Awaiting Response)", "completed": "Completed",
    "declined": "Declined", "avg_processing_days": "Average Processing Time (days)",
}


def generate_owwa_report(stats: dict, request_rows: list[dict], date_str: str, generated_by: str, generated_role: str) -> bytes:
    """OWWA Assistance Program report — KPI summary + request detail table, same
    summary/section shape as generate_manpower_report, reusing the same helpers."""
    summary_rows = "".join(
        f"<tr><th style='width:280px'>{_esc(OWWA_STAT_LABELS.get(k, k))}</th><td>{_val(v)}</td></tr>"
        for k, v in stats.items()
    )
    columns = [
        ("reference_number", "Reference #"), ("jobseeker_name", "Applicant"), ("ofw_relationship", "OFW Status / Relationship"),
        ("status", "Status"), ("submitted_at", "Submitted"), ("verified_at", "Verified"),
        ("submitted_to_owwa_at", "Submitted to OWWA"), ("for_owwa_response_at", "OWWA Response/Follow-up"),
        ("completed_at", "Completed"), ("appointment_at", "PESO Appointment"), ("declined_reason", "Declined Reason"),
    ]

    body = f"""
    <h2>OWWA Assistance Program Report</h2>
    <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)} ({_esc(generated_role)})</p>
    <h3>Summary</h3>
    <table>{summary_rows}</table>
    <h3>Requests ({len(request_rows)})</h3>
    {_series_table(request_rows, columns)}
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body, landscape=True)


def generate_spes_application_form(application_dict: dict, profile_dict: dict, batch_dict: dict, qr_data_url: str, date_str: str) -> bytes:
    """Official SPES Application Form, auto-generated on registration (see
    blueprints/spes.py::register_spes_batch) with the applicant's registration QR
    embedded — same plain-dict + embedded-QR convention as
    generate_jobfair_registration_form/generate_owwa_application_form."""

    def row(label, value):
        return f"<tr><th style='width:220px'>{_esc(label)}</th><td>{_val(value)}</td></tr>"

    reference_rows = "".join([
        row("Application Reference No.", application_dict.get("application_ref_no")),
        row("Batch", batch_dict.get("batch_name")),
        row("Date Submitted", date_str),
        row("Status", (application_dict.get("status") or "").replace("_", " ").title()),
    ])
    applicant_rows = "".join([
        row("Full Name", application_dict.get("full_name")),
        row("Age", application_dict.get("age")),
        row("School", application_dict.get("school_name")),
        row("Year Level", application_dict.get("year_level")),
        row("Family Income", application_dict.get("family_income")),
        row("GWA", application_dict.get("gwa")),
        row("Contact Number", profile_dict.get("contact_number")),
        row("Complete Address", profile_dict.get("address")),
    ])
    requirements = batch_dict.get("requirements") or []
    requirements_html = "".join(f"<li>{_esc(r)}</li>" for r in requirements) or "<li>No additional requirements specified.</li>"

    body = f"""
    <h2 style="color:#1e3a8a;text-align:center">SPES — APPLICATION FORM</h2>
    <p style="text-align:center;color:#64748b;font-size:11px">Generated via JobBridge — Public Employment Service Office, Pila, Laguna</p>

    <h3>Reference Information</h3>
    <table>{reference_rows}</table>

    <h3>Applicant Information</h3>
    <table>{applicant_rows}</table>

    <h3>Requirements to Bring</h3>
    <ul>{requirements_html}</ul>

    <div style="text-align:center;margin-top:24px">
      <p><b>Present this QR code at the PESO Office for orientation and exam attendance:</b></p>
      <img src="{qr_data_url}" alt="QR Code" width="170" height="170"/>
    </div>
    <div class="footer">This form was auto-generated by JobBridge from the applicant's PESO profile and SPES registration.</div>
    """
    return _render(body)




def _dilp_fmt_dt(value, fmt: str = "%b %d, %Y %I:%M %p") -> str:
    """dilp_report_row() already returns Manila-converted datetimes (and plain date
    objects for date_of_birth) — format directly, no further conversion needed here."""
    return value.strftime(fmt) if value else ""


def generate_dilp_report(rows: list[dict], date_str: str, generated_by: str, generated_role: str, columns: list[tuple]) -> bytes:
    """DILP applicant-detail report — no dashboard cards, metrics, charts, or analytics,
    per the export content requirement (contrast generate_owwa_report/generate_spes_*
    exports, which do include a KPI summary — DILP's export is intentionally scoped to
    applicant records only). `columns`: (dilp_report_row() dict key, header label) pairs,
    passed by the caller (blueprints/dilp.py's _DILP_APPLICATION_COLUMNS) so there's one
    canonical column list shared with the Excel export."""
    if not rows:
        body = f"""
        <h2>DILP Applicant Report</h2>
        <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)} ({_esc(generated_role)})</p>
        <p>No applicants matched the selected filters.</p>
        <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
        """
        return _render(body, landscape=True)

    formatted_rows = [
        {**r, "date_of_birth": _dilp_fmt_dt(r.get("date_of_birth"), "%b %d, %Y"), "application_date": _dilp_fmt_dt(r.get("application_date"))}
        for r in rows
    ]

    body = f"""
    <h2>DILP Applicant Report</h2>
    <p>Generated: {_esc(date_str)} | Generated By: {_esc(generated_by)} ({_esc(generated_role)})</p>
    <h3>Applicants ({len(formatted_rows)})</h3>
    {_series_table(formatted_rows, columns)}
    <div class="footer">JobBridge — PESO Pila, Laguna official report</div>
    """
    return _render(body, landscape=True)


def to_bytesio(pdf_bytes: bytes) -> io.BytesIO:
    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf
