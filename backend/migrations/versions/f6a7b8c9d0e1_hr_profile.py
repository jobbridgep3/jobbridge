"""Phase 2: HR/Employer Personal Profile (separate from Company Profile)

Adds employer_hr_profiles (1:1 with users, denormalized employer_company_id) and
employer_hr_documents. Backfills one HR profile per existing EmployerCompany from
its vestigial hr_contact_name (-> full_name) and contact_number (-> mobile_number,
seeded but not removed from employer_companies — Phase 1 already repurposed that
column as the company's own Basic-Info "Contact Number", a distinct, still-live
field). Only hr_contact_name (truly vestigial, no Phase 1 usage) is dropped from
employer_companies.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-12 00:00:00.000000

"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'employer_hr_profiles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employer_company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('profile_picture_url', sa.String(length=1000), nullable=True),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('gender', sa.String(length=20), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('civil_status', sa.String(length=30), nullable=True),
        sa.Column('nationality', sa.String(length=100), nullable=True),
        sa.Column('personal_email', sa.String(length=255), nullable=True),
        sa.Column('mobile_number', sa.String(length=30), nullable=True),
        sa.Column('telephone_number', sa.String(length=30), nullable=True),
        sa.Column('employee_id', sa.String(length=50), nullable=True),
        sa.Column('department', sa.String(length=150), nullable=True),
        sa.Column('position', sa.String(length=150), nullable=True),
        sa.Column('employment_status', sa.String(length=30), nullable=True),
        sa.Column('hr_role', sa.String(length=30), nullable=True),
        sa.Column('region_code', sa.String(length=10), nullable=True),
        sa.Column('region_name', sa.String(length=150), nullable=True),
        sa.Column('province_code', sa.String(length=10), nullable=True),
        sa.Column('province_name', sa.String(length=150), nullable=True),
        sa.Column('city_municipality_code', sa.String(length=10), nullable=True),
        sa.Column('city_municipality_name', sa.String(length=150), nullable=True),
        sa.Column('barangay_code', sa.String(length=15), nullable=True),
        sa.Column('barangay_name', sa.String(length=150), nullable=True),
        sa.Column('street_address', sa.String(length=255), nullable=True),
        sa.Column('zip_code', sa.String(length=10), nullable=True),
        sa.Column('emergency_contact_name', sa.String(length=255), nullable=True),
        sa.Column('emergency_contact_relationship', sa.String(length=100), nullable=True),
        sa.Column('emergency_contact_number', sa.String(length=30), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("civil_status IN ('Single', 'Married', 'Widowed', 'Separated', 'Divorced')", name='ck_employer_hr_civil_status'),
        sa.CheckConstraint("employment_status IN ('regular', 'probationary', 'contractual', 'part_time')", name='ck_employer_hr_employment_status'),
        sa.CheckConstraint("hr_role IN ('hr_officer', 'hr_manager', 'recruiter', 'owner', 'admin_staff')", name='ck_employer_hr_role'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employer_company_id'], ['employer_companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    with op.batch_alter_table('employer_hr_profiles', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_employer_hr_profiles_employer_company_id'), ['employer_company_id'], unique=False)

    op.create_table(
        'employer_hr_documents',
        sa.Column('employer_hr_profile_id', postgresql.UUID(as_uuid=True), nullable=False),
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
            "document_type IN ('government_id', 'company_id', 'authorization_letter', 'prc_license', 'hr_certificate', 'digital_signature')",
            name='ck_employer_hr_document_type',
        ),
        sa.CheckConstraint("status IN ('pending_review', 'verified', 'rejected')", name='ck_employer_hr_document_status'),
        sa.ForeignKeyConstraint(['employer_hr_profile_id'], ['employer_hr_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('employer_hr_documents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_employer_hr_documents_employer_hr_profile_id'), ['employer_hr_profile_id'], unique=False)

    # ### backfill: one HR profile per existing employer, from the vestigial fields ###
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, user_id, hr_contact_name, contact_number FROM employer_companies")).fetchall()
    now = datetime.now(timezone.utc)
    for company_id, user_id, hr_contact_name, contact_number in rows:
        bind.execute(
            sa.text(
                "INSERT INTO employer_hr_profiles "
                "(id, user_id, employer_company_id, full_name, mobile_number, nationality, created_at, updated_at) "
                "VALUES (:id, :user_id, :company_id, :full_name, :mobile_number, 'Filipino', :now, :now)"
            ),
            {
                "id": str(uuid.uuid4()), "user_id": str(user_id), "company_id": str(company_id),
                "full_name": hr_contact_name or "", "mobile_number": contact_number, "now": now,
            },
        )

    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.drop_column('hr_contact_name')


def downgrade():
    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hr_contact_name', sa.String(length=255), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT employer_company_id, full_name FROM employer_hr_profiles")).fetchall()
    for company_id, full_name in rows:
        bind.execute(
            sa.text("UPDATE employer_companies SET hr_contact_name = :full_name WHERE id = :id"),
            {"full_name": full_name, "id": str(company_id)},
        )

    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.alter_column('hr_contact_name', existing_type=sa.String(length=255), nullable=False, server_default='')

    with op.batch_alter_table('employer_hr_documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employer_hr_documents_employer_hr_profile_id'))
    op.drop_table('employer_hr_documents')

    with op.batch_alter_table('employer_hr_profiles', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employer_hr_profiles_employer_company_id'))
    op.drop_table('employer_hr_profiles')
