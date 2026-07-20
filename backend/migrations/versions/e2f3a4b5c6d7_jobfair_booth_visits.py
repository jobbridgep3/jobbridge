"""Job fair booth-level registration ("Register to Booth"), distinct from the
existing fair-wide JobFairRegistration: tracks which jobseekers registered
interest in a specific employer's booth, per-booth check-in, and an optional
link to the Application created once the employer picks a vacancy for them.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
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


def downgrade():
    op.drop_table('jobfair_booth_visits')
