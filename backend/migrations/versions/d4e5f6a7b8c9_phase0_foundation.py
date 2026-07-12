"""Phase 0 foundation: audit trail before/after/user-agent, employer company documents

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # ### audit_trail: before/after diff snapshots + user-agent, all additive/nullable ###
    with op.batch_alter_table('audit_trail', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_agent', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('before_state', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('after_state', sa.JSON(), nullable=True))

    # ### employer_company_documents: typed/statused document uploads, replacing the
    # ### bare employer_companies.document_urls JSON list (migrated + dropped in Phase 1,
    # ### once the upload endpoint itself is rewritten to use this table) ###
    op.create_table(
        'employer_company_documents',
        sa.Column('employer_company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('file_url', sa.String(length=1000), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "document_type IN ('business_permit', 'business_registration_certificate', 'bir_registration', "
            "'company_logo', 'philgeps', 'mayors_permit', 'dole_registration', 'peza_certificate', "
            "'accreditation_certificate', 'iso_certificate', 'safety_certificate', 'rep_gov_id', "
            "'authorization_letter', 'company_id')",
            name='ck_employer_company_document_type',
        ),
        sa.CheckConstraint("status IN ('pending_review', 'verified', 'rejected')", name='ck_employer_company_document_status'),
        sa.ForeignKeyConstraint(['employer_company_id'], ['employer_companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('employer_company_documents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_employer_company_documents_employer_company_id'), ['employer_company_id'], unique=False)


def downgrade():
    with op.batch_alter_table('employer_company_documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employer_company_documents_employer_company_id'))
    op.drop_table('employer_company_documents')

    with op.batch_alter_table('audit_trail', schema=None) as batch_op:
        batch_op.drop_column('after_state')
        batch_op.drop_column('before_state')
        batch_op.drop_column('user_agent')
