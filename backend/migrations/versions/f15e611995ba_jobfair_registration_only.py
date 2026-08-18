"""Job Fair becomes scheduling/registration-only: drop the booth-visit /
employer-application-linking table, and add an atomic per-year counter table
backing race-condition-safe registration-number generation.

Revision ID: f15e611995ba
Revises: c44c29b3e9c2
Create Date: 2026-08-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f15e611995ba'
down_revision = 'c44c29b3e9c2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'jobfair_registration_counters',
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('next_seq', sa.Integer(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('year'),
    )
    op.drop_table('jobfair_booth_visits')


def downgrade():
    op.create_table(
        'jobfair_booth_visits',
        sa.Column('jobfair_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('booth_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('jobseeker_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('checked_in', sa.Boolean(), nullable=False),
        sa.Column('checked_in_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['jobfair_id'], ['jobfairs.id']),
        sa.ForeignKeyConstraint(['booth_id'], ['jobfair_booths.id']),
        sa.ForeignKeyConstraint(['jobseeker_profile_id'], ['jobseeker_profiles.id']),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('booth_id', 'jobseeker_profile_id', name='uq_booth_visit_jobseeker'),
    )
    op.drop_table('jobfair_registration_counters')
