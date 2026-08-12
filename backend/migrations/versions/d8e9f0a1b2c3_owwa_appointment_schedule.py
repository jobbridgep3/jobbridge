"""Add appointment_at (PESO office schedule) to owwa_requests

Revision ID: d8e9f0a1b2c3
Revises: c6d7e8f9a0b1
Create Date: 2026-08-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd8e9f0a1b2c3'
down_revision = 'c6d7e8f9a0b1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('owwa_requests', schema=None) as batch_op:
        batch_op.add_column(sa.Column('appointment_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    with op.batch_alter_table('owwa_requests', schema=None) as batch_op:
        batch_op.drop_column('appointment_at')
