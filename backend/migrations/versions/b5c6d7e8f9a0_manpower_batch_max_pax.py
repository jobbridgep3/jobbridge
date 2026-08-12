"""Add max_pax (capacity ceiling) to manpower_training_batches

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-08-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b5c6d7e8f9a0'
down_revision = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('manpower_training_batches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('max_pax', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('manpower_training_batches', schema=None) as batch_op:
        batch_op.drop_column('max_pax')
