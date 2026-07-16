"""Announcement module overhaul: category, priority, banner/gallery/PDF,
explicit draft/published/archived status, scheduling + expiry, and
multi-role audience targeting (replaces the single-value target_audience
with a target_roles JSON list supporting public/jobseeker/employer/staff/
admin in any combination).

Data migration: status backfilled from the existing published_at (NULL =
draft, else published); target_roles backfilled from target_audience
('all' -> every role incl. public, 'jobseekers' -> ['jobseeker'],
'employers' -> ['employer']) before the old column is dropped.

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-07-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f9a0b1c2d3e4'
down_revision = 'e8f9a0b1c2d3'
branch_labels = None
depends_on = None

CATEGORIES = "'general', 'job_fair', 'training', 'spes', 'owwa', 'dilp', 'manpower_skills_training', 'system_update', 'others'"
PRIORITIES = "'normal', 'important', 'urgent'"
STATUSES = "'draft', 'published', 'archived'"


def upgrade():
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category', sa.String(length=40), nullable=False, server_default='general'))
        batch_op.add_column(sa.Column('priority', sa.String(length=10), nullable=False, server_default='normal'))
        batch_op.add_column(sa.Column('banner_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('gallery_images', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('pdf_url', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(length=10), nullable=False, server_default='draft'))
        batch_op.add_column(sa.Column('scheduled_publish_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
        # JSONB, not plain JSON — the app queries this column with Postgres's
        # @> containment operator (SQLAlchemy's .contains()), which only
        # compiles correctly against jsonb; on a plain json column it silently
        # falls back to a text LIKE match that would never match correctly.
        batch_op.add_column(sa.Column('target_roles', postgresql.JSONB(), nullable=True))
        batch_op.create_check_constraint('ck_announcement_category', f"category IN ({CATEGORIES})")
        batch_op.create_check_constraint('ck_announcement_priority', f"priority IN ({PRIORITIES})")
        batch_op.create_check_constraint('ck_announcement_status', f"status IN ({STATUSES})")

    op.execute("UPDATE announcements SET status = 'published' WHERE published_at IS NOT NULL")

    op.execute(
        "UPDATE announcements SET target_roles = "
        "CASE target_audience "
        "WHEN 'all' THEN '[\"public\",\"jobseeker\",\"employer\",\"staff\",\"admin\"]'::jsonb "
        "WHEN 'jobseekers' THEN '[\"jobseeker\"]'::jsonb "
        "WHEN 'employers' THEN '[\"employer\"]'::jsonb "
        "ELSE '[\"public\",\"jobseeker\",\"employer\",\"staff\",\"admin\"]'::jsonb END"
    )

    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.alter_column(
            'target_roles', existing_type=postgresql.JSONB(), nullable=False,
            server_default='["public","jobseeker","employer","staff","admin"]',
        )
        batch_op.drop_constraint('ck_announcement_target', type_='check')
        batch_op.drop_column('target_audience')


def downgrade():
    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('target_audience', sa.String(length=20), nullable=True))

    op.execute(
        "UPDATE announcements SET target_audience = "
        "CASE WHEN target_roles::jsonb @> '[\"jobseeker\"]' AND target_roles::jsonb @> '[\"employer\"]' THEN 'all' "
        "WHEN target_roles::jsonb @> '[\"jobseeker\"]' THEN 'jobseekers' "
        "WHEN target_roles::jsonb @> '[\"employer\"]' THEN 'employers' ELSE 'all' END"
    )

    with op.batch_alter_table('announcements', schema=None) as batch_op:
        batch_op.alter_column('target_audience', existing_type=sa.String(length=20), nullable=False)
        batch_op.create_check_constraint('ck_announcement_target', "target_audience IN ('all', 'jobseekers', 'employers')")
        batch_op.drop_column('target_roles')
        batch_op.drop_constraint('ck_announcement_status', type_='check')
        batch_op.drop_constraint('ck_announcement_priority', type_='check')
        batch_op.drop_constraint('ck_announcement_category', type_='check')
        batch_op.drop_column('expires_at')
        batch_op.drop_column('scheduled_publish_at')
        batch_op.drop_column('status')
        batch_op.drop_column('pdf_url')
        batch_op.drop_column('gallery_images')
        batch_op.drop_column('banner_url')
        batch_op.drop_column('priority')
        batch_op.drop_column('category')
