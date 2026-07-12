from datetime import datetime, timedelta

from flask import Blueprint, request, send_file
from flask_jwt_extended import jwt_required

from extensions import db
from models.employment import EmploymentRecord
from models.program import ProgramApplication
from models.vacancy import Vacancy
from services.excel_service import build_excel_report
from services.pdf_service import generate_table_report, to_bytesio
from utils.decorators import role_required
from utils.responses import ok

lmi_bp = Blueprint("lmi", __name__, url_prefix="/api/staff/lmi")


def _date_range(period: str):
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
    total_placements = EmploymentRecord.query.count()
    active = EmploymentRecord.query.filter_by(status="active").count()
    terminated = EmploymentRecord.query.filter_by(status="terminated").count()
    completed = EmploymentRecord.query.filter_by(status="completed").count()

    industries = {}
    for record in EmploymentRecord.query.all():
        industry = record.employer_company.industry or "Unspecified"
        industries[industry] = industries.get(industry, 0) + 1

    program_counts = {}
    for p in ("spes", "dilp", "owwa"):
        program_counts[p] = ProgramApplication.query.filter_by(program_type=p).count()

    return ok({
        "total_placements": total_placements,
        "active": active, "terminated": terminated, "completed": completed,
        "success_rate": round((active + completed) / total_placements * 100, 1) if total_placements else 0,
        "top_industries": [{"industry": k, "count": v} for k, v in sorted(industries.items(), key=lambda x: -x[1])[:8]],
        "program_beneficiaries": program_counts,
        "active_vacancies": Vacancy.query.filter_by(status="published").count(),
    })


@lmi_bp.get("/report/<period>")
@jwt_required()
@role_required("staff", "admin")
def lmi_report(period):
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
    records = EmploymentRecord.query.all()
    rows = [[r.jobseeker_profile.full_name, r.employer_company.company_name, r.position, r.status, str(r.start_date)] for r in records]
    buf = build_excel_report("LMI Report", ["Jobseeker", "Employer", "Position", "Status", "Start Date"], rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="lmi_report.xlsx")


@lmi_bp.get("/export/pdf")
@jwt_required()
@role_required("staff", "admin")
def export_pdf():
    records = EmploymentRecord.query.all()
    rows = [[r.jobseeker_profile.full_name, r.employer_company.company_name, r.position, r.status, str(r.start_date)] for r in records]
    pdf_bytes = generate_table_report("Labor Market Information Report", ["Jobseeker", "Employer", "Position", "Status", "Start Date"], rows, datetime.utcnow().strftime("%Y-%m-%d"))
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="lmi_report.pdf")
