import secrets
import string
from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.audit import AuditTrail
from models.employer import EmployerCompany
from models.employment import EmploymentRecord
from models.interview import Interview
from models.jobseeker import JobseekerProfile
from models.user import User
from models.vacancy import Vacancy, VacancyCategory
from services.audit_query_service import build_audit_query
from services.audit_service import log_audit
from services.dashboard_service import build_analytics, build_dashboard_excel, build_dashboard_pdf, build_summary
from services.email_service import send_staff_credentials_email
from services.excel_service import build_excel_report
from services.pdf_service import generate_table_report, to_bytesio
from utils.decorators import role_required
from utils.responses import fail, ok

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _generate_temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


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
    return ok(build_summary())


@admin_bp.get("/dashboard/analytics")
@jwt_required()
@role_required("admin")
def dashboard_analytics():
    months = int(request.args.get("months", 6))
    return ok(build_analytics(months, request.args.get("date_from"), request.args.get("date_to")))


@admin_bp.get("/dashboard/pending-actions")
@jwt_required()
@role_required("admin")
def dashboard_pending_actions():
    return ok({
        "pending_employer_verifications": EmployerCompany.query.filter_by(accreditation_status="pending_review").count(),
        "pending_job_approvals": Vacancy.query.filter_by(status="pending").count(),
        "pending_interviews": Interview.query.filter_by(status="pending").count(),
        # No report-submission workflow exists in the schema — this is a proxy for
        # "items flagged for staff review" using the two existing flagged-item fields.
        "pending_reports": (
            JobseekerProfile.query.filter_by(is_flagged=True).count()
            + EmploymentRecord.query.filter_by(flagged_discrepancy=True).count()
        ),
    })


@admin_bp.get("/dashboard/export/excel")
@jwt_required()
@role_required("admin")
def export_dashboard_excel():
    buf = build_dashboard_excel(request.args)
    log_audit(User.query.get(get_jwt_identity()), "Export", "dashboard")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="dashboard_report.xlsx")


@admin_bp.get("/dashboard/export/pdf")
@jwt_required()
@role_required("admin")
def export_dashboard_pdf():
    actor = User.query.get(get_jwt_identity())
    pdf_bytes = build_dashboard_pdf(request.args, actor.email)
    log_audit(User.query.get(get_jwt_identity()), "Export", "dashboard")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="dashboard_report.pdf")


# ---------- Staff Management (Admin-exclusive) ----------

@admin_bp.get("/staff")
@jwt_required()
@role_required("admin")
def list_staff():
    # joinedload avoids an N+1 SELECT against jobseeker_profiles for every row here now
    # that User.to_dict() reads self.jobseeker_profile (always None for staff, but the
    # lazy relationship access would still fire once per row without this).
    staff_users = (
        User.query.options(db.joinedload(User.jobseeker_profile))
        .filter_by(role="staff")
        .order_by(User.created_at.desc())
        .all()
    )
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
    sort_asc = request.args.get("sort") == "asc"
    query = build_audit_query(request.args).order_by(
        AuditTrail.created_at.asc() if sort_asc else AuditTrail.created_at.desc()
    )
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(int(request.args.get("limit", 50)), 200)
    total = query.count()
    entries = query.offset((page - 1) * limit).limit(limit).all()
    return ok({"items": [e.to_dict() for e in entries], "total": total, "page": page, "limit": limit})


@admin_bp.get("/audit/export/excel")
@jwt_required()
@role_required("admin")
def export_audit_excel():
    entries = build_audit_query(request.args).order_by(AuditTrail.created_at.desc()).limit(20000).all()
    rows = [[e.created_at, e.user_email, e.user_role, e.action, e.module, e.record_id, e.ip_address, e.status] for e in entries]
    buf = build_excel_report("Audit Trail", ["Timestamp", "User", "Role", "Action", "Module", "Record ID", "IP", "Status"], rows)
    log_audit(User.query.get(get_jwt_identity()), "Export", "audit_trail")
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="audit_trail.xlsx")


@admin_bp.get("/audit/export/pdf")
@jwt_required()
@role_required("admin")
def export_audit_pdf():
    entries = build_audit_query(request.args).order_by(AuditTrail.created_at.desc()).limit(20000).all()
    rows = [[str(e.created_at), e.user_email, e.action, e.module, e.status] for e in entries]
    pdf_bytes = generate_table_report("Audit Trail", ["Timestamp", "User", "Action", "Module", "Status"], rows, datetime.utcnow().strftime("%Y-%m-%d"))
    log_audit(User.query.get(get_jwt_identity()), "Export", "audit_trail")
    return send_file(to_bytesio(pdf_bytes), mimetype="application/pdf", as_attachment=True, download_name="audit_trail.pdf")


# ---------- Vacancy Categories (Admin-exclusive management) ----------

@admin_bp.get("/vacancy-categories")
@jwt_required()
@role_required("admin")
def admin_list_vacancy_categories():
    categories = VacancyCategory.query.order_by(VacancyCategory.name).all()
    return ok([c.to_dict() for c in categories])


@admin_bp.post("/vacancy-categories")
@jwt_required()
@role_required("admin")
def create_vacancy_category():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return fail("Category name is required.", 400)
    if VacancyCategory.query.filter_by(name=name).first():
        return fail("A category with this name already exists.", 409)

    category = VacancyCategory(name=name)
    db.session.add(category)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "vacancy_categories", category.id, name)
    return ok(category.to_dict(), "Category created.", 201)


@admin_bp.put("/vacancy-categories/<category_id>")
@jwt_required()
@role_required("admin")
def update_vacancy_category(category_id):
    category = VacancyCategory.query.get(category_id)
    if not category:
        return fail("Category not found.", 404)
    data = request.get_json(force=True) or {}
    if "name" in data and data["name"].strip():
        category.name = data["name"].strip()
    if "is_active" in data:
        category.is_active = bool(data["is_active"])
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Update", "vacancy_categories", category.id)
    return ok(category.to_dict(), "Category updated.")


@admin_bp.delete("/vacancy-categories/<category_id>")
@jwt_required()
@role_required("admin")
def delete_vacancy_category(category_id):
    category = VacancyCategory.query.get(category_id)
    if not category:
        return fail("Category not found.", 404)
    if Vacancy.query.filter_by(category_id=category.id).count() > 0:
        return fail("This category is in use by existing vacancies and cannot be deleted. Deactivate it instead.", 409)

    db.session.delete(category)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Delete", "vacancy_categories", category_id)
    return ok(message="Category deleted.")
