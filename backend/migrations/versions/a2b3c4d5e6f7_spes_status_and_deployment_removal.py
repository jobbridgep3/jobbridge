"""SPES: symmetric orientation/exam attendance+result statuses, PESO appointment,
remove Deployment/DTR tracking

Orientation and Exam now share the same shape (QR attendance auto-advances status;
Staff then records a separate pass/fail result) — adds 'orientation_passed' and
'attended_exam' to the status enum. Deployment/DTR tracking is removed entirely
(PESO coordinates placement in person once an applicant passes; the system's
involvement now ends with a PESO-office appointment on spes_applications). The 2
existing rows in 'for_deployment' at the time of writing are remapped to 'passed'
(the new terminal "passed exam, awaiting PESO appointment" state) — see upgrade()
for the full, deliberately lossy remap of any other legacy deployment-era statuses.
spes_deployments/spes_dtr_entries have 0 rows at the time of writing, confirmed via
direct query, so dropping them loses no real data.

Revision ID: a2b3c4d5e6f7
Revises: e9f0a1b2c3d4
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'e9f0a1b2c3d4'
branch_labels = None
depends_on = None

OLD_STATUSES = (
    "pending_review", "rejected", "approved_for_orientation", "attended_orientation",
    "failed_orientation", "passed", "failed", "for_deployment", "deployed", "completed", "terminated",
)
NEW_STATUSES = (
    "pending_review", "rejected", "approved_for_orientation", "attended_orientation",
    "orientation_passed", "failed_orientation", "attended_exam", "passed", "failed",
)


def upgrade():
    # Deliberately lossy remap — deployment/office-assignment detail (if any existed)
    # is not preserved, since deployment tracking is being removed by explicit request.
    op.execute("UPDATE spes_applications SET status = 'passed' WHERE status IN ('for_deployment', 'deployed', 'completed')")
    op.execute("UPDATE spes_applications SET status = 'failed' WHERE status = 'terminated'")

    with op.batch_alter_table('spes_applications', schema=None) as batch_op:
        batch_op.drop_constraint('ck_spes_application_status', type_='check')
        batch_op.create_check_constraint('ck_spes_application_status', f"status IN {NEW_STATUSES}")
        batch_op.add_column(sa.Column('peso_appointment_at', sa.DateTime(timezone=True), nullable=True))

    op.drop_table('spes_dtr_entries')
    op.drop_table('spes_deployments')


def downgrade():
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

    with op.batch_alter_table('spes_applications', schema=None) as batch_op:
        batch_op.drop_column('peso_appointment_at')
        batch_op.drop_constraint('ck_spes_application_status', type_='check')
        batch_op.create_check_constraint('ck_spes_application_status', f"status IN {OLD_STATUSES}")
    # Note: the upgrade()'s status remap (for_deployment/deployed/completed/terminated
    # -> passed/failed) is not reversed here — that mapping is one-way by design (see
    # module docstring), consistent with how this codebase's other data-affecting
    # migrations are documented.
