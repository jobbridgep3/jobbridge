"""FTJS: first-time jobseeker flag + RA 11261 barangay certificate number

Revision ID: c7d8e9f0a1b2
Revises: b44c6a1f3e3b
Create Date: 2026-08-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = 'b44c6a1f3e3b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_first_time_jobseeker', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('barangay_certificate_number', sa.String(length=50), nullable=True))


def downgrade():
    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.drop_column('barangay_certificate_number')
        batch_op.drop_column('is_first_time_jobseeker')
