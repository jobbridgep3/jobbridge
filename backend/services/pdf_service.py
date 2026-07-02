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


def to_bytesio(pdf_bytes: bytes) -> io.BytesIO:
    buf = io.BytesIO(pdf_bytes)
    buf.seek(0)
    return buf
