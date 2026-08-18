"""Job-fair-only positions: lets a confirmed employer identify what they'll
offer in person at a specific Job Fair, entirely separate from the regular
Vacancy model — no staff approval, no online application, no general job
search visibility. Scoped to the employer's JobFairBooth registration.

Revision ID: b44c6a1f3e3b
Revises: 11f31a29c940
Create Date: 2026-08-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b44c6a1f3e3b'
down_revision = '11f31a29c940'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'jobfair_positions',
        sa.Column('booth_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('job_type', sa.String(length=30), nullable=True),
        sa.Column('num_slots', sa.Integer(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['booth_id'], ['jobfair_booths.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('jobfair_positions')
