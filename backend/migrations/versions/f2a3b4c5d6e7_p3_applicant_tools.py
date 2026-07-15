"""Phase 3 (system upgrade): application messages, additional document requests, job offers

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = 'e1f2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    # Allow ad hoc "additional" documents uploaded in response to employer requests.
    with op.batch_alter_table('jobseeker_documents', schema=None) as batch_op:
        batch_op.drop_constraint('ck_jobseeker_document_type', type_='check')
        batch_op.create_check_constraint(
            'ck_jobseeker_document_type',
            "document_type IN ('government_id', 'id_photo_2x2', 'diploma', 'training_certificate', "
            "'certificate_of_employment', 'additional')",
        )

    op.create_table(
        'application_messages',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('application_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_application_messages_application_id'), ['application_id'], unique=False)

    op.create_table(
        'document_requests',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('document_label', sa.String(length=255), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('submitted_document_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'submitted', 'cancelled')", name='ck_document_request_status'),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submitted_document_id'], ['jobseeker_documents.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('document_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_document_requests_application_id'), ['application_id'], unique=False)

    op.create_table(
        'job_offers',
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('position', sa.String(length=255), nullable=False),
        sa.Column('salary_offer', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('employment_type', sa.String(length=30), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('terms', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('pdf_url', sa.String(length=1000), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('offered', 'accepted', 'declined', 'withdrawn')", name='ck_job_offer_status'),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('application_id'),
    )


def downgrade():
    op.execute("DELETE FROM jobseeker_documents WHERE document_type = 'additional'")
    with op.batch_alter_table('jobseeker_documents', schema=None) as batch_op:
        batch_op.drop_constraint('ck_jobseeker_document_type', type_='check')
        batch_op.create_check_constraint(
            'ck_jobseeker_document_type',
            "document_type IN ('government_id', 'id_photo_2x2', 'diploma', 'training_certificate', "
            "'certificate_of_employment')",
        )

    op.drop_table('job_offers')
    with op.batch_alter_table('document_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_document_requests_application_id'))
    op.drop_table('document_requests')
    with op.batch_alter_table('application_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_application_messages_application_id'))
    op.drop_table('application_messages')
