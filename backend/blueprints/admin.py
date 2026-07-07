import secrets
import string
from datetime import date, datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func

from extensions import db
from models.application import APPLICATION_STATUSES, Application
from models.audit import AuditTrail
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy
from services.audit_service import log_audit
from services.email_service import send_staff_credentials_email
from services.excel_service import build_excel_report
from services.nlp_service import SKILL_KEYWORDS
from services.pdf_service import generate_table_report, to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok
from utils.timezone import now_manila

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


def _month_buckets(n: int):
    """Returns the last n (year, month) tuples ending at the current month, oldest first."""
    today = now_manila().date()
    y, m = today.year, today.month
    buckets = []
    for _ in range(n):
        buckets.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    buckets.reverse()
    return buckets


# ---------- Integration status ----------

@admin_bp.get("/integrations-status")
@jwt_required()
@role_required("admin")
def integrations_status():
    from services.ocr_service import is_vision_configured

    return ok({"vision_configured": is_vision_configured()})


# ---------- Dashboard Analytics (Admin-exclusive) ----------

@admin_bp.get("/dashboard/summary")
@jwt_required()
@role_required("admin")
def dashboard_summary():
    total_jobseekers = JobseekerProfile.query.count()
    active_employers = (
        db.session.query(EmployerCompany)
        .join(User, EmployerCompany.user_id == User.id)
        .filter(EmployerCompany.verification_status == "verified", User.is_active.is_(True))
        .count()
    )
    active_vacancies = Vacancy.query.filter_by(status="active").count()
    total_applications = Application.query.count()
    total_placements = EmploymentRecord.query.count()
    successful_placements = EmploymentRecord.query.filter(
        EmploymentRecord.status.in_(("active", "completed"))
    ).count()
    placements_this_month = EmploymentRecord.query.filter(
        EmploymentRecord.start_date >= now_manila().date().replace(day=1)
    ).count()

    return ok({
        "total_jobseekers": total_jobseekers,
        "active_employers": active_employers,
        "active_vacancies": active_vacancies,
        "total_applications": total_applications,
        "successful_placements": successful_placements,
        "placements_this_month": placements_this_month,
        # Same formula as lmi.py's success_rate (active+completed / total) — kept in sync
        # by convention rather than importing across blueprints for one derived percentage.
        "placement_success_rate": round(successful_placements / total_placements * 100, 1) if total_placements else 0,
        # Distinct from placement_success_rate: "of everyone registered, what fraction has
        # ever been placed" (program outcome) vs. "of placements made, what fraction held."
        "employment_rate": round(successful_placements / total_jobseekers * 100, 1) if total_jobseekers else 0,
    })


@admin_bp.get("/dashboard/analytics")
@jwt_required()
@role_required("admin")
def dashboard_analytics():
    months = min(max(int(request.args.get("months", 6)), 1), 12)
    buckets = _month_buckets(months)
    labels = [f"{y:04d}-{m:02d}" for y, m in buckets]
    start_date = date(buckets[0][0], buckets[0][1], 1)

    # Monthly User Registrations — grouped by role so the chart can show two series.
    reg_rows = (
        db.session.query(func.to_char(User.created_at, "YYYY-MM").label("month"), User.role, func.count(User.id))
        .filter(User.created_at >= start_date, User.role.in_(("jobseeker", "employer")))
        .group_by("month", User.role)
        .all()
    )
    reg_map = {}
    for month, role, count in reg_rows:
        reg_map.setdefault(month, {"jobseekers": 0, "employers": 0})
        reg_map[month]["jobseekers" if role == "jobseeker" else "employers"] = count
    monthly_registrations = [
        {"month": lbl, "jobseekers": 0, "employers": 0, **reg_map.get(lbl, {})} for lbl in labels
    ]

    # Monthly Job Applications
    app_rows = dict(
        db.session.query(func.to_char(Application.created_at, "YYYY-MM"), func.count(Application.id))
        .filter(Application.created_at >= start_date)
        .group_by(func.to_char(Application.created_at, "YYYY-MM"))
        .all()
    )
    monthly_applications = [{"month": lbl, "count": app_rows.get(lbl, 0)} for lbl in labels]

    # Employment Trends — new placements started per month
    emp_rows = dict(
        db.session.query(func.to_char(EmploymentRecord.start_date, "YYYY-MM"), func.count(EmploymentRecord.id))
        .filter(EmploymentRecord.start_date >= start_date)
        .group_by(func.to_char(EmploymentRecord.start_date, "YYYY-MM"))
        .all()
    )
    employment_trends = [{"month": lbl, "placements": emp_rows.get(lbl, 0)} for lbl in labels]

    # Hiring Analytics — the Application status funnel. Scaffolded against the model's own
    # status tuple so a stage with zero applications still renders as a 0 bar, not a gap.
    funnel_rows = dict(db.session.query(Application.status, func.count(Application.id)).group_by(Application.status).all())
    hiring_funnel = [{"status": s, "count": funnel_rows.get(s, 0)} for s in APPLICATION_STATUSES]

    # Job Category Distribution — active vacancies by industry (top 8)
    category_rows = (
        db.session.query(Vacancy.industry, func.count(Vacancy.id))
        .filter(Vacancy.status == "active")
        .group_by(Vacancy.industry)
        .order_by(func.count(Vacancy.id).desc())
        .all()
    )
    job_category_distribution = [{"category": ind or "Unspecified", "count": cnt} for ind, cnt in category_rows[:8]]

    # Most Requested Skills — Vacancy.skills_required is free text (tokenized for TF-IDF,
    # not structured), so there's no GROUP BY for this. Reuse the same curated skill
    # taxonomy already used to parse jobseeker resumes, matched against active vacancies
    # only (small N at municipal-PESO scale, unlike LMI's unbounded full-table loops).
    skill_counts = {}
    for v in Vacancy.query.filter_by(status="active").all():
        text = (v.skills_required or "").lower()
        for kw in SKILL_KEYWORDS:
            if kw in text:
                skill_counts[kw] = skill_counts.get(kw, 0) + 1
    top_skills = [
        {"skill": k.title(), "count": c} for k, c in sorted(skill_counts.items(), key=lambda x: -x[1])[:10]
    ]

    return ok({
        "monthly_registrations": monthly_registrations,
        "monthly_applications": monthly_applications,
        "employment_trends": employment_trends,
        "hiring_funnel": hiring_funnel,
        "job_category_distribution": job_category_distribution,
        "top_skills": top_skills,
    })


@admin_bp.get("/dashboard/pending-actions")
@jwt_required()
@role_required("admin")
def dashboard_pending_actions():
    return ok({
        "pending_employer_verifications": EmployerCompany.query.filter_by(verification_status="unverified").count(),
        "pending_job_approvals": Vacancy.query.filter_by(status="pending").count(),
        "pending_interviews": Interview.query.filter_by(status="pending").count(),
        # No report-submission workflow exists in the schema — this is a proxy for
        # "items flagged for staff review" using the two existing flagged-item fields.
        "pending_reports": (
            JobseekerProfile.query.filter_by(is_flagged=True).count()
            + EmploymentRecord.query.filter_by(flagged_discrepancy=True).count()
        ),
    })


# ---------- Staff Management (Admin-exclusive) ----------

@admin_bp.get("/staff")
@jwt_required()
@role_required("admin")
def list_staff():
    staff_users = User.query.filter_by(role="staff").order_by(User.created_at.desc()).all()
    return ok([
        {
            **u.to_dict(),
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "actions_count": AuditTrail.query.filter_by(user_id=u.id).count(),
        }
        for u in staff_users
    ])


@admin_bp.post("/staff")
@jwt_required()
@role_required("admin")
def create_staff():
    data = request.get_json(force=True) or {}
    email = data.get("email")
    full_name = data.get("full_name", "")
    if not email or not full_name:
        return fail("full_name and email are required.", 400)
    if User.query.filter_by(email=email).first():
        return fail("An account with this email already exists.", 409)

    temp_password = _generate_temp_password()
    user = User(email=email, role="staff", is_verified=True, must_change_password=True)
    user.set_password(temp_password)
    db.session.add(user)
    db.session.commit()

    send_staff_credentials_email(email, full_name, temp_password)
    log_audit(User.query.get(get_jwt_identity()), "Account Create", "staff", user.id, f"Created staff account {email}")

    return ok(user.to_dict(), "Staff account created and credentials emailed.", 201)


@admin_bp.put("/staff/<staff_id>")
@jwt_required()
@role_required("admin")
def update_staff(staff_id):
    user = User.query.filter_by(id=staff_id, role="staff").first()
    if not user:
        return fail("Staff account not found.", 404)
    data = request.get_json(force=True) or {}
    if data.get("email"):
        user.email = data["email"]
    if data.get("reset_password"):
        temp_password = _generate_temp_password()
        user.set_password(temp_password)
        user.must_change_password = True
        send_staff_credentials_email(user.email, data.get("full_name", "PESO Staff"), temp_password)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "staff", user.id)
    return ok(user.to_dict(), "Staff account updated.")


@admin_bp.put("/staff/<staff_id>/deactivate")
@jwt_required()
@role_required("admin")
def deactivate_staff(staff_id):
    user = User.query.filter_by(id=staff_id, role="staff").first()
    if not user:
        return fail("Staff account not found.", 404)
    user.is_active = not user.is_active
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "staff", user.id, f"is_active={user.is_active}")
    return ok(user.to_dict(), "Staff account updated.")


# ---------- Audit Trail (Admin-exclusive, immutable) ----------

@admin_bp.get("/audit")
@jwt_required()
@role_required("admin")
def get_audit_trail():
    query = AuditTrail.query
    if request.args.get("user_role"):
        query = query.filter_by(user_role=request.args["user_role"])
    if request.args.get("action"):
        query = query.filter_by(action=request.args["action"])
    if request.args.get("module"):
        query = query.filter_by(module=request.args["module"])
    if request.args.get("q"):
        like = f"%{request.args['q']}%"
        query = query.filter(db.or_(AuditTrail.user_email.ilike(like), AuditTrail.details.ilike(like)))
    entries = query.order_by(AuditTrail.created_at.desc()).limit(500).all()
    return ok([e.to_dict() for e in entries])


@admin_bp.get("/audit/export/excel")
@jwt_required()
@role_required("admin")
def export_audit_excel():
    entries = AuditTrail.query.order_by(AuditTrail.created_at.desc()).limit(5000).all()
    rows = [[e.created_at, e.user_email, e.user_role, e.action, e.module, e.record_id, e.ip_address] for e in entries]
    buf = build_excel_report("Audit Trail", ["Timestamp", "User", "Role", "Action", "Module", "Record ID", "IP"], rows)
    log_audit(User.query.get(get_jwt_identity()), "Export", "audit_trail")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="audit_trail.xlsx")


@admin_bp.get("/audit/export/pdf")
@jwt_required()
@role_required("admin")
def export_audit_pdf():
    entries = AuditTrail.query.order_by(AuditTrail.created_at.desc()).limit(1000).all()
    rows = [[str(e.created_at), e.user_email, e.action, e.module] for e in entries]
    pdf_bytes = generate_table_report("Audit Trail", ["Timestamp", "User", "Action", "Module"], rows, datetime.utcnow().strftime("%Y-%m-%d"))
    log_audit(User.query.get(get_jwt_identity()), "Export", "audit_trail")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="audit_trail.pdf")
