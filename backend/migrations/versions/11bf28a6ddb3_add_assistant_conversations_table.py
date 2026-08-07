"""add assistant_conversations table

Revision ID: 11bf28a6ddb3
Revises: f3a4b5c6d7e8
Create Date: 2026-08-07 19:18:18.459297

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '11bf28a6ddb3'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    # Hand-trimmed from the raw `flask db migrate` autogenerate output, which also
    # picked up unrelated pre-existing drift between the live DB and current model
    # definitions (index differences on several unrelated tables, nullability on
    # several `vacancies` boolean columns) — none of that is part of this change and
    # is deliberately left untouched here, per "existing database schema stays
    # untouched." This migration does exactly one thing: adds the new table.
    op.create_table(
        'assistant_conversations',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('messages', sa.JSON(), nullable=False),
        sa.Column('is_pinned', sa.Boolean(), nullable=False),
        sa.Column('is_favorite', sa.Boolean(), nullable=False),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('assistant_conversations', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_assistant_conversations_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('assistant_conversations', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assistant_conversations_user_id'))
    op.drop_table('assistant_conversations')
