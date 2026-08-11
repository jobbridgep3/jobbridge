"""add manpower_training_batches and manpower_training_applications tables

Revision ID: a4b5c6d7e8f9
Revises: 11bf28a6ddb3
Create Date: 2026-08-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a4b5c6d7e8f9'
down_revision = '11bf28a6ddb3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'manpower_training_batches',
        sa.Column('batch_name', sa.String(length=255), nullable=False),
        sa.Column('min_pax', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('project_proposal_url', sa.String(length=1000), nullable=True),
        sa.Column('submitted_to_tesda_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tesda_response_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('forming', 'submitted_to_tesda', 'for_tesda_response', 'completed', 'declined')", name='ck_manpower_batch_status'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'manpower_training_applications',
        sa.Column('jobseeker_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('program_interest', sa.String(length=255), nullable=False),
        sa.Column('application_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'pooled', 'submitted_to_tesda', 'for_tesda_response', 'completed', 'declined')", name='ck_manpower_application_status'),
        sa.ForeignKeyConstraint(['jobseeker_profile_id'], ['jobseeker_profiles.id']),
        sa.ForeignKeyConstraint(['batch_id'], ['manpower_training_batches.id']),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('manpower_training_applications')
    op.drop_table('manpower_training_batches')
