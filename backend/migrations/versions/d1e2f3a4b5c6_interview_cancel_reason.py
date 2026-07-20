"""Require a reason note when an employer cancels an interview

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7
Create Date: 2026-07-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cancel_reason', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('interviews', schema=None) as batch_op:
        batch_op.drop_column('cancel_reason')
