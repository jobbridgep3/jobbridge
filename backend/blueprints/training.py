from datetime import datetime

from flask import Blueprint, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.jobseeker import JobseekerProfile
from models.training import TrainingEnrollment, TrainingProgram
from models.user import User
from services.audit_service import log_audit
from services.excel_service import build_excel_report
from services.notification_service import notify_user
from services.pdf_service import generate_certificate, to_bytesio
from services.qr_service import generate_qr_data_url
from services.storage_service import upload_file
from utils.decorators import role_required
from utils.responses import fail, ok

training_bp = Blueprint("training", __name__, url_prefix="/api/training")
staff_training_bp = Blueprint("staff_training", __name__, url_prefix="/api/staff/training")


@training_bp.get("")
@jwt_required()
def list_training():
    programs = TrainingProgram.query.filter(TrainingProgram.status != "archived").order_by(TrainingProgram.schedule.asc()).all()
    return ok([p.to_dict() for p in programs])


@training_bp.post("/<program_id>/enroll")
@jwt_required()
@role_required("jobseeker")
def enroll(program_id):
    program = TrainingProgram.query.get(program_id)
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not program or not profile:
        return fail("Not found.", 404)
    if TrainingEnrollment.query.filter_by(program_id=program.id, jobseeker_profile_id=profile.id).first():
        return fail("Already enrolled.", 409)
    if len(program.enrollments) >= program.max_slots:
        enrollment = TrainingEnrollment(program_id=program.id, jobseeker_profile_id=profile.id, status="waitlisted")
    else:
        enrollment = TrainingEnrollment(program_id=program.id, jobseeker_profile_id=profile.id, status="enrolled")
    db.session.add(enrollment)
    db.session.commit()
    return ok(enrollment.to_dict(), "Enrollment confirmed.", 201)


@training_bp.get("/my-enrollments")
@jwt_required()
@role_required("jobseeker")
def my_enrollments():
    profile = JobseekerProfile.query.filter_by(user_id=get_jwt_identity()).first()
    if not profile:
        return ok([])
    enrollments = TrainingEnrollment.query.filter_by(jobseeker_profile_id=profile.id).all()
    return ok([e.to_dict() for e in enrollments])


# ---------- Staff ----------

@staff_training_bp.post("")
@jwt_required()
@role_required("staff", "admin")
def create_program():
    data = request.get_json(force=True) or {}
    program = TrainingProgram(
        title=data.get("title", ""), description=data.get("description"), trainer=data.get("trainer"),
        venue=data.get("venue"), schedule=datetime.fromisoformat(data["schedule"]),
        max_slots=data.get("max_slots", 30), created_by=get_jwt_identity(),
    )
    db.session.add(program)
    db.session.commit()
    log_audit(User.query.get(get_jwt_identity()), "Create", "training", program.id)
    return ok(program.to_dict(), "Training program created.", 201)


@staff_training_bp.put("/<program_id>")
@jwt_required()
@role_required("staff", "admin")
def update_program(program_id):
    program = TrainingProgram.query.get(program_id)
    if not program:
        return fail("Program not found.", 404)
    data = request.get_json(force=True) or {}
    for field in ("title", "description", "trainer", "venue", "max_slots", "status"):
        if field in data:
            setattr(program, field, data[field])
    db.session.commit()
    return ok(program.to_dict(), "Program updated.")


@staff_training_bp.post("/<program_id>/scan-qr")
@jwt_required()
@role_required("staff", "admin")
def scan_qr(program_id):
    data = request.get_json(force=True) or {}
    enrollment = TrainingEnrollment.query.filter_by(program_id=program_id, qr_token=data.get("qr_token")).first()
    if not enrollment:
        return fail("Invalid QR code.", 404)
    enrollment.status = "attended"
    db.session.commit()
    return ok(enrollment.to_dict(), "Attendance marked.")


@staff_training_bp.post("/<program_id>/issue-certificate")
@jwt_required()
@role_required("staff", "admin")
def issue_certificate(program_id):
    data = request.get_json(force=True) or {}
    enrollment = TrainingEnrollment.query.get(data.get("enrollment_id"))
    program = TrainingProgram.query.get(program_id)
    if not enrollment or not program:
        return fail("Not found.", 404)

    pdf_bytes = generate_certificate(enrollment.jobseeker_profile.full_name, program.title, datetime.utcnow().strftime("%B %d, %Y"))
    url = upload_file(pdf_bytes, "certificate.pdf", folder=f"certificates/{enrollment.jobseeker_profile_id}", content_type="application/pdf")

    enrollment.status = "certificate_issued"
    enrollment.certificate_url = url
    db.session.commit()

    notify_user(
        enrollment.jobseeker_profile.user_id, "certificate_issued", "Certificate Issued",
        f"Your certificate for {program.title} is ready.", link="/jobseeker/training",
        socket_event="certificate:issued", socket_payload=enrollment.to_dict(),
    )
    return ok(enrollment.to_dict(), "Certificate issued.")


@staff_training_bp.get("/report")
@jwt_required()
@role_required("staff", "admin")
def training_report():
    programs = TrainingProgram.query.all()
    rows = [[p.title, len(p.enrollments), p.status] for p in programs]
    buf = build_excel_report("Training Report", ["Program", "Enrolled", "Status"], rows)
    return send_file(buf, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", as_attachment=True, download_name="training_report.xlsx")
