"""Add region_code/region_name/zip_code to jobseeker_profiles, matching the
address structure already present on EmployerCompany. Existing barangay/
municipality/province string columns are left untouched.

Data migration: none — all three columns are nullable and no existing data
maps cleanly to a PSGC region code, so rows are left NULL until a jobseeker
re-saves their profile through the updated address form.

Revision ID: d7e8f9a0b1c2
Revises: c5d6e7f8a9b0
Create Date: 2026-07-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd7e8f9a0b1c2'
down_revision = 'c5d6e7f8a9b0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('region_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('region_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('zip_code', sa.String(length=10), nullable=True))


def downgrade():
    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.drop_column('zip_code')
        batch_op.drop_column('region_name')
        batch_op.drop_column('region_code')
