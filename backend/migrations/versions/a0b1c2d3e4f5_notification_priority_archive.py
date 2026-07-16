"""Notification module upgrade: adds is_archived (Archive action) and an
optional priority column (explicitly set for announcement-sourced
notifications; every other existing notify_user() call site is unaffected
and falls back to a client-side type->priority map).

Data migration: none — is_archived defaults false for all existing rows,
priority stays NULL (frontend fallback map covers it).

Revision ID: a0b1c2d3e4f5
Revises: f9a0b1c2d3e4
Create Date: 2026-07-16 00:00:00.000001

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a0b1c2d3e4f5'
down_revision = 'f9a0b1c2d3e4'
branch_labels = None
depends_on = None

PRIORITIES = "'normal', 'important', 'urgent'"


def upgrade():
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('priority', sa.String(length=10), nullable=True))
        batch_op.create_check_constraint('ck_notification_priority', f"priority IS NULL OR priority IN ({PRIORITIES})")


def downgrade():
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_constraint('ck_notification_priority', type_='check')
        batch_op.drop_column('priority')
        batch_op.drop_column('is_archived')
