from datetime import datetime, timedelta

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from models.employment import EmploymentRecord
from models.user import User
from services.audit_service import log_audit
from services.lmi_service import (
    build_barangay_analytics,
    build_employer_industry_analytics,
    build_employment_funnel,
    build_filter_options,
    build_job_demand_analytics,
    build_jobseeker_profile_analytics,
    build_kpi_summary,
    build_lmi_excel,
    build_lmi_pdf,
    build_skills_gap_analytics,
    parse_lmi_filters,
)
from services.pdf_service import to_bytesio
from utils.decorators import role_required
from utils.responses import ok

lmi_bp = Blueprint("lmi", __name__, url_prefix="/api/staff/lmi")


def _date_range(period: str):
    """Retained for the legacy /report/<period> endpoint below — unrelated to
    the new parse_lmi_filters() used everywhere else in this module."""
    now = datetime.utcnow()
    if period == "quarterly":
        start = now - timedelta(days=90)
    elif period == "annual":
        start = now - timedelta(days=365)
    else:
        start = now.replace(day=1)
    return start, now


@lmi_bp.get("/stats")
@jwt_required()
@role_required("staff", "admin")
def lmi_stats():
    filters = parse_lmi_filters(request.args)
    return ok(build_kpi_summary(filters))


@lmi_bp.get("/jobseeker-profile")
@jwt_required()
@role_required("staff", "admin")
def lmi_jobseeker_profile():
    filters = parse_lmi_filters(request.args)
    return ok(build_jobseeker_profile_analytics(filters))


@lmi_bp.get("/job-demand")
@jwt_required()
@role_required("staff", "admin")
def lmi_job_demand():
    filters = parse_lmi_filters(request.args)
    return ok(build_job_demand_analytics(filters))


@lmi_bp.get("/skills-gap")
@jwt_required()
@role_required("staff", "admin")
def lmi_skills_gap():
    filters = parse_lmi_filters(request.args)
    return ok(build_skills_gap_analytics(filters))


@lmi_bp.get("/employment-funnel")
@jwt_required()
@role_required("staff", "admin")
def lmi_employment_funnel():
    filters = parse_lmi_filters(request.args)
    return ok(build_employment_funnel(filters))


@lmi_bp.get("/employer-industry")
@jwt_required()
@role_required("staff", "admin")
def lmi_employer_industry():
    filters = parse_lmi_filters(request.args)
    return ok(build_employer_industry_analytics(filters))


@lmi_bp.get("/barangay")
@jwt_required()
@role_required("staff", "admin")
def lmi_barangay():
    filters = parse_lmi_filters(request.args)
    return ok(build_barangay_analytics(filters))


@lmi_bp.get("/filter-options")
@jwt_required()
@role_required("staff", "admin")
def lmi_filter_options():
    return ok(build_filter_options())


@lmi_bp.get("/report/<period>")
@jwt_required()
@role_required("staff", "admin")
def lmi_report(period):
    """Legacy endpoint — no frontend caller as of this module's rework, kept
    as-is (not removed) since it costs nothing to leave and nothing depends
    on it changing."""
    start, end = _date_range(period)
    records = EmploymentRecord.query.filter(EmploymentRecord.start_date >= start.date()).all()
    return ok({
        "period": period,
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "placements": len(records),
        "records": [r.to_dict() for r in records],
    })


@lmi_bp.get("/export/excel")
@jwt_required()
@role_required("staff", "admin")
def export_excel():
    filters = parse_lmi_filters(request.args)
    buf = build_lmi_excel(filters)
    log_audit(User.query.get(get_jwt_identity()), "Export", "lmi_report", details="excel")
    return send_file(
        buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True, download_name="lmi_report.xlsx",
    )


@lmi_bp.get("/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_pdf():
    filters = parse_lmi_filters(request.args)
    user = User.query.get(get_jwt_identity())
    pdf_bytes = build_lmi_pdf(filters, f"{user.email} ({user.role})")
    log_audit(user, "Export", "lmi_report", details="pdf")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="lmi_report.pdf")
