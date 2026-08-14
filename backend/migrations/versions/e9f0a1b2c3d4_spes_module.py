"""Add spes_batches, spes_applications, spes_attendance_logs, spes_deployments,
spes_dtr_entries tables

Standalone SPES module — distinct from the existing program_applications table
(still used by DILP), since SPES's batch/orientation/exam/deployment/DTR lifecycle
doesn't fit the shared PROGRAM_STATUSES enum, mirroring exactly how OWWA was
previously extracted (see c6d7e8f9a0b1_owwa_assistance_module.py). Old
program_applications rows with program_type='spes' are not migrated.

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-08-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e9f0a1b2c3d4'
down_revision = 'd8e9f0a1b2c3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'spes_batches',
        sa.Column('batch_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('open_date', sa.Date(), nullable=False),
        sa.Column('registration_deadline', sa.Date(), nullable=False),
        sa.Column('total_slots', sa.Integer(), nullable=False),
        sa.Column('budget_allocation', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('requirements', sa.JSON(), nullable=True),
        sa.Column('min_gwa', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('max_family_income', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('orientation_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('orientation_venue', sa.String(length=500), nullable=True),
        sa.Column('orientation_dress_code', sa.JSON(), nullable=True),
        sa.Column('orientation_notice_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('exam_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('exam_venue', sa.String(length=500), nullable=True),
        sa.Column('exam_dress_code', sa.JSON(), nullable=True),
        sa.Column('exam_notice_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('open', 'closed', 'archived')", name='ck_spes_batch_status'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'spes_applications',
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('jobseeker_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_ref_no', sa.String(length=30), nullable=False),
        sa.Column('qr_token', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('school_name', sa.String(length=255), nullable=False),
        sa.Column('year_level', sa.String(length=50), nullable=False),
        sa.Column('family_income', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('gwa', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('document_urls', sa.JSON(), nullable=True),
        sa.Column('application_form_pdf_url', sa.String(length=1000), nullable=True),
        sa.Column('review_remarks', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('orientation_outcome_remarks', sa.Text(), nullable=True),
        sa.Column('orientation_outcome_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('orientation_outcome_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('exam_result_remarks', sa.Text(), nullable=True),
        sa.Column('exam_result_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('exam_result_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending_review', 'rejected', 'approved_for_orientation', 'attended_orientation', "
            "'failed_orientation', 'passed', 'failed', 'for_deployment', 'deployed', 'completed', 'terminated')",
            name='ck_spes_application_status',
        ),
        sa.ForeignKeyConstraint(['batch_id'], ['spes_batches.id']),
        sa.ForeignKeyConstraint(['jobseeker_profile_id'], ['jobseeker_profiles.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['orientation_outcome_by'], ['users.id']),
        sa.ForeignKeyConstraint(['exam_result_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('application_ref_no', name='uq_spes_application_ref_no'),
        sa.UniqueConstraint('qr_token', name='uq_spes_application_qr_token'),
        sa.UniqueConstraint('batch_id', 'jobseeker_profile_id', name='uq_spes_batch_jobseeker'),
    )

    op.create_table(
        'spes_attendance_logs',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=20), nullable=False),
        sa.Column('scanned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scanned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("event_type IN ('orientation', 'exam')", name='ck_spes_attendance_event_type'),
        sa.ForeignKeyConstraint(['application_id'], ['spes_applications.id']),
        sa.ForeignKeyConstraint(['scanned_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('application_id', 'event_type', name='uq_spes_attendance_event'),
    )

    op.create_table(
        'spes_deployments',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employer_company_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('office_name', sa.String(length=255), nullable=True),
        sa.Column('supervisor_name', sa.String(length=255), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terminated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('termination_reason', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("employer_company_id IS NOT NULL OR office_name IS NOT NULL", name='ck_spes_deployment_employer'),
        sa.ForeignKeyConstraint(['application_id'], ['spes_applications.id']),
        sa.ForeignKeyConstraint(['employer_company_id'], ['employer_companies.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('application_id', name='uq_spes_deployment_application'),
    )

    op.create_table(
        'spes_dtr_entries',
        sa.Column('deployment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('work_date', sa.Date(), nullable=False),
        sa.Column('time_in', sa.Time(), nullable=False),
        sa.Column('time_out', sa.Time(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('staff_remarks', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_spes_dtr_status'),
        sa.ForeignKeyConstraint(['deployment_id'], ['spes_deployments.id']),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('deployment_id', 'work_date', name='uq_spes_dtr_date'),
    )


def downgrade():
    op.drop_table('spes_dtr_entries')
    op.drop_table('spes_deployments')
    op.drop_table('spes_attendance_logs')
    op.drop_table('spes_applications')
    op.drop_table('spes_batches')
