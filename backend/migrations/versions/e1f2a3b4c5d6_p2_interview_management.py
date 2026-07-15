"""Phase 2 (system upgrade): interview result/score/interviewer/meeting-link fields,
'rescheduled' status, and jobseeker reschedule-request workflow

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e1f2a3b4c5d6'
down_revision = 'd0e1f2a3b4c5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.add_column(sa.Column('meeting_link', sa.String(length=1000), nullable=True))
        batch_op.add_column(sa.Column('interviewer_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('result', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('score', sa.SmallInteger(), nullable=True))
        batch_op.drop_constraint('ck_interview_status', type_='check')
        batch_op.create_check_constraint(
            'ck_interview_status',
            "status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled', 'rescheduled')",
        )

    op.execute("UPDATE interviews SET result = 'pending' WHERE result IS NULL")

    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.alter_column('result', existing_type=sa.String(length=20), nullable=False)
        batch_op.create_check_constraint(
            'ck_interview_result', "result IN ('pending', 'passed', 'failed', 'shortlisted', 'hired')",
        )

    op.create_table(
        'interview_reschedule_requests',
        sa.Column('interview_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('preferred_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('responded_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('response_note', sa.Text(), nullable=True),
        sa.Column('suggested_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'suggested', 'superseded')",
            name='ck_reschedule_request_status',
        ),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['responded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('interview_reschedule_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_interview_reschedule_requests_interview_id'), ['interview_id'], unique=False)


def downgrade():
    with op.batch_alter_table('interview_reschedule_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_interview_reschedule_requests_interview_id'))
    op.drop_table('interview_reschedule_requests')

    op.execute("UPDATE interviews SET status = 'pending' WHERE status = 'rescheduled'")

    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.drop_constraint('ck_interview_result', type_='check')
        batch_op.drop_constraint('ck_interview_status', type_='check')
        batch_op.create_check_constraint(
            'ck_interview_status', "status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')",
        )
        batch_op.drop_column('score')
        batch_op.drop_column('result')
        batch_op.drop_column('interviewer_name')
        batch_op.drop_column('meeting_link')
