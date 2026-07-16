"""Job fair booth approval workflow: booth registration now creates a
'pending' request instead of auto-confirming, reviewed by PESO staff/admin.
Adds review_remarks/reviewed_by/reviewed_at (mirrors Vacancy.approved_by/
approved_at) and extends BOOTH_STATUSES with 'rejected'/'suspended'.

Data migration: existing booths keep status='confirmed' — they predate the
review workflow and are not retroactively re-reviewed.

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-07-16 00:00:00.000001

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'e8f9a0b1c2d3'
down_revision = 'd7e8f9a0b1c2'
branch_labels = None
depends_on = None

NEW_STATUSES = "'pending', 'confirmed', 'cancelled', 'rejected', 'suspended'"


def upgrade():
    with op.batch_alter_table('jobfair_booths', schema=None) as batch_op:
        batch_op.add_column(sa.Column('review_remarks', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by', UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_foreign_key('fk_booth_reviewed_by_users', 'users', ['reviewed_by'], ['id'])
        batch_op.drop_constraint('ck_booth_status', type_='check')
        batch_op.create_check_constraint('ck_booth_status', f"status IN ({NEW_STATUSES})")


def downgrade():
    with op.batch_alter_table('jobfair_booths', schema=None) as batch_op:
        batch_op.drop_constraint('ck_booth_status', type_='check')
        batch_op.create_check_constraint('ck_booth_status', "status IN ('pending', 'confirmed', 'cancelled')")
        batch_op.drop_constraint('fk_booth_reviewed_by_users', type_='foreignkey')
        batch_op.drop_column('reviewed_at')
        batch_op.drop_column('reviewed_by')
        batch_op.drop_column('review_remarks')
