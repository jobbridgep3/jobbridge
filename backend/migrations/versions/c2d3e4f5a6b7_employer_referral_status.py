"""Employer Referral Management: adds an employer-facing review status to
vacancy-scoped referral letters, separate from the existing PESO-staff
status. NULL employer_status means "not yet employer-visible" (still
PESO-pending, PESO-rejected, or a general referral with no vacancy).

Data migration: none — all new columns nullable, existing rows keep
employer_status=NULL until they're re-approved through the new pipeline.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-07-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None

EMPLOYER_STATUSES = "'pending', 'accepted', 'rejected'"


def upgrade():
    with op.batch_alter_table('referral_letters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('employer_status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('employer_rejection_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by_employer', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('employer_reviewed_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('referral_number', sa.String(length=20), nullable=True))
        batch_op.create_foreign_key('fk_referral_letters_reviewed_by_employer', 'users', ['reviewed_by_employer'], ['id'])
        batch_op.create_unique_constraint('uq_referral_letters_referral_number', ['referral_number'])
        batch_op.create_check_constraint(
            'ck_referral_employer_status', f"employer_status IS NULL OR employer_status IN ({EMPLOYER_STATUSES})",
        )


def downgrade():
    with op.batch_alter_table('referral_letters', schema=None) as batch_op:
        batch_op.drop_constraint('ck_referral_employer_status', type_='check')
        batch_op.drop_constraint('uq_referral_letters_referral_number', type_='unique')
        batch_op.drop_constraint('fk_referral_letters_reviewed_by_employer', type_='foreignkey')
        batch_op.drop_column('referral_number')
        batch_op.drop_column('employer_reviewed_at')
        batch_op.drop_column('reviewed_by_employer')
        batch_op.drop_column('employer_rejection_reason')
        batch_op.drop_column('employer_status')
