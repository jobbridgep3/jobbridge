"""Phase 5 (system upgrade): expanded employment lifecycle + terms + status history

Adds pending_deployment / probationary / regular / contract_ended / resigned to the
employment status constraint (existing active/terminated/completed rows untouched),
salary / employment_type / work_arrangement / remarks columns, and the
employment_status_history timeline table.

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b4c5d6e7f8a9'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None

NEW_STATUSES = (
    "'pending_deployment', 'active', 'probationary', 'regular', "
    "'contract_ended', 'resigned', 'terminated', 'completed'"
)


def upgrade():
    with op.batch_alter_table('employment_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('salary', sa.Numeric(precision=12, scale=2), nullable=True))
        batch_op.add_column(sa.Column('employment_type', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('work_arrangement', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('remarks', sa.Text(), nullable=True))
        batch_op.drop_constraint('ck_employment_status', type_='check')
        batch_op.create_check_constraint('ck_employment_status', f"status IN ({NEW_STATUSES})")

    op.create_table(
        'employment_status_history',
        sa.Column('record_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_status', sa.String(length=20), nullable=True),
        sa.Column('to_status', sa.String(length=20), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['record_id'], ['employment_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('employment_status_history', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_employment_status_history_record_id'), ['record_id'], unique=False)


def downgrade():
    with op.batch_alter_table('employment_status_history', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employment_status_history_record_id'))
    op.drop_table('employment_status_history')

    # Collapse expanded statuses back onto the closest legacy value.
    op.execute("UPDATE employment_records SET status = 'active' WHERE status IN ('pending_deployment', 'probationary', 'regular')")
    op.execute("UPDATE employment_records SET status = 'completed' WHERE status = 'contract_ended'")
    op.execute("UPDATE employment_records SET status = 'terminated' WHERE status = 'resigned'")

    with op.batch_alter_table('employment_records', schema=None) as batch_op:
        batch_op.drop_constraint('ck_employment_status', type_='check')
        batch_op.create_check_constraint('ck_employment_status', "status IN ('active', 'terminated', 'completed')")
        batch_op.drop_column('remarks')
        batch_op.drop_column('work_arrangement')
        batch_op.drop_column('employment_type')
        batch_op.drop_column('salary')
