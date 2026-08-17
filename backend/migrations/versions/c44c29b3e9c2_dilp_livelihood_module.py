"""Add dilp_applications, dilp_application_documents, dilp_application_remarks,
dilp_status_history tables

Standalone DILP (DOLE Integrated Livelihood Program) module — distinct from the existing
program_applications table (still referenced by legacy dilp rows), since DILP's real
status lifecycle (pending/scheduled/completed/no_show/ready_for_claiming/approved/
submitted_to_esfo) doesn't fit the shared PROGRAM_STATUSES enum. Mirrors the OWWA
Assistance Program module's migration shape, plus a status-history table for DILP's
no_show -> scheduled reschedule loop.

Revision ID: c44c29b3e9c2
Revises: a2b3c4d5e6f7
Create Date: 2026-08-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c44c29b3e9c2'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dilp_applications',
        sa.Column('jobseeker_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('proposed_livelihood', sa.String(length=255), nullable=False),
        sa.Column('business_description', sa.Text(), nullable=False),
        sa.Column('capital_needed', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('interview_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('no_show_count', sa.Integer(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ready_for_claiming_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_to_esfo_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'scheduled', 'completed', 'no_show', 'ready_for_claiming', 'approved', 'submitted_to_esfo')",
            name='ck_dilp_application_status',
        ),
        sa.ForeignKeyConstraint(['jobseeker_profile_id'], ['jobseeker_profiles.id']),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'dilp_application_documents',
        sa.Column('dilp_application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_url', sa.String(length=1000), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('ocr_text', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dilp_application_id'], ['dilp_applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'dilp_application_remarks',
        sa.Column('dilp_application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('remark', sa.Text(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dilp_application_id'], ['dilp_applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'dilp_status_history',
        sa.Column('dilp_application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=True),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['dilp_application_id'], ['dilp_applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_dilp_status_history_dilp_application_id'), 'dilp_status_history', ['dilp_application_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_dilp_status_history_dilp_application_id'), table_name='dilp_status_history')
    op.drop_table('dilp_status_history')
    op.drop_table('dilp_application_remarks')
    op.drop_table('dilp_application_documents')
    op.drop_table('dilp_applications')
