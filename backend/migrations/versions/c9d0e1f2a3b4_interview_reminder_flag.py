"""Phase 8: idempotency guard for the scheduled interview-reminder job

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.add_column(sa.Column('reminder_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.drop_column('reminder_sent_at')
