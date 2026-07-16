"""Adds theme_preference to users for server-persisted Dark Mode, so the
setting survives logout/login and browser changes instead of living only
in localStorage.

Data migration: none — defaults to 'system' for all existing users.

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-07-16 00:00:00.000002

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None

THEMES = "'light', 'dark', 'system'"


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('theme_preference', sa.String(length=10), nullable=False, server_default='system'))
        batch_op.create_check_constraint('ck_users_theme_preference', f"theme_preference IN ({THEMES})")


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('ck_users_theme_preference', type_='check')
        batch_op.drop_column('theme_preference')
