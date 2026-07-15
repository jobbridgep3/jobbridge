"""Phase 1 (system upgrade): expanded application status pipeline + status history timeline

Adds shortlisted / interview_completed / background_verification / offer_extended to
the application status CHECK constraint (existing values keep their meaning — no data
migration needed) and creates application_status_history for the jobseeker-facing
timeline. Widens status to VARCHAR(30) to fit 'background_verification'.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd0e1f2a3b4c5'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None

NEW_STATUSES = (
    "'applied', 'under_review', 'shortlisted', 'interview_scheduled', 'interview_completed', "
    "'background_verification', 'offer_extended', 'hired', 'rejected', 'cancelled'"
)
OLD_STATUSES = "'applied', 'under_review', 'interview_scheduled', 'hired', 'rejected', 'cancelled'"


def upgrade():
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.alter_column('status', existing_type=sa.String(length=20), type_=sa.String(length=30), existing_nullable=False)
        batch_op.drop_constraint('ck_application_status', type_='check')
        batch_op.create_check_constraint('ck_application_status', f"status IN ({NEW_STATUSES})")

    op.create_table(
        'application_status_history',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_status', sa.String(length=30), nullable=True),
        sa.Column('to_status', sa.String(length=30), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('application_status_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_application_status_history_application_id'), ['application_id'], unique=False)


def downgrade():
    with op.batch_alter_table('application_status_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_application_status_history_application_id'))
    op.drop_table('application_status_history')

    # Collapse the new pipeline statuses back onto the closest legacy value before
    # re-tightening the CHECK constraint.
    op.execute("UPDATE applications SET status = 'under_review' WHERE status IN ('shortlisted', 'background_verification', 'offer_extended')")
    op.execute("UPDATE applications SET status = 'interview_scheduled' WHERE status = 'interview_completed'")

    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.drop_constraint('ck_application_status', type_='check')
        batch_op.create_check_constraint('ck_application_status', f"status IN ({OLD_STATUSES})")
        batch_op.alter_column('status', existing_type=sa.String(length=30), type_=sa.String(length=20), existing_nullable=False)
