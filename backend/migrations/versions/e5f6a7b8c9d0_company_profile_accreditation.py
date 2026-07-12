"""Phase 1: Company Profile expansion + accreditation state machine

Replaces employer_companies.verification_status (unverified|verified|suspended) with
accreditation_status (not_submitted|pending_review|accredited|rejected|suspended) and
verification_remarks with accreditation_remarks, in one atomic cutover (data migrated,
old columns dropped in this same migration — no dual-column window). Also replaces the
untyped document_urls JSON list with rows in employer_company_documents (added in
d4e5f6a7b8c9), best-effort bucketed as 'business_registration_certificate' since the
old data carried no type information.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-12 00:00:00.000000

"""
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        # Basic Information
        batch_op.add_column(sa.Column('trade_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('business_type', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('nature_of_business', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('year_established', sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column('num_employees', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('company_size', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('company_email', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('alt_contact_number', sa.String(length=30), nullable=True))

        # Business Registration
        batch_op.add_column(sa.Column('bir_tin', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('sec_number', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('dti_number', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('cda_number', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('philgeps_registration_no', sa.String(length=50), nullable=True))

        # Address
        batch_op.add_column(sa.Column('region_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('region_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('province_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('province_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('city_municipality_code', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('city_municipality_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('barangay_code', sa.String(length=15), nullable=True))
        batch_op.add_column(sa.Column('barangay_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('street_address', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('zip_code', sa.String(length=10), nullable=True))

        # Company Representative
        batch_op.add_column(sa.Column('rep_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('rep_position', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('rep_email', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('rep_contact_number', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('rep_gov_id_number', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('rep_signature_url', sa.String(length=1000), nullable=True))

        # Employment Information (hiring_status backfilled below, then set NOT NULL)
        batch_op.add_column(sa.Column('hiring_status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('preferred_hiring_areas', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('work_setup', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('employment_types_offered', sa.JSON(), nullable=True))

        # Social Media
        batch_op.add_column(sa.Column('facebook_url', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('linkedin_url', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('instagram_url', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('x_url', sa.String(length=255), nullable=True))

        # Accreditation (backfilled from verification_status below, then set NOT NULL)
        batch_op.add_column(sa.Column('accreditation_status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('accreditation_remarks', sa.Text(), nullable=True))

    # ### backfill ###
    op.execute("UPDATE employer_companies SET hiring_status = 'not_hiring'")
    op.execute(
        "UPDATE employer_companies SET accreditation_status = CASE verification_status "
        "WHEN 'verified' THEN 'accredited' WHEN 'suspended' THEN 'suspended' ELSE 'not_submitted' END"
    )
    op.execute("UPDATE employer_companies SET accreditation_remarks = verification_remarks")

    # ### data migration: document_urls (untyped JSON list of URLs) -> employer_company_documents ###
    # Old data carries no document-type info, so it's bucketed as the closest generic
    # type ('business_registration_certificate') for staff to re-triage on review.
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, document_urls FROM employer_companies WHERE document_urls IS NOT NULL")).fetchall()
    now = datetime.now(timezone.utc)
    for company_id, urls in rows:
        for url in (urls or []):
            bind.execute(
                sa.text(
                    "INSERT INTO employer_company_documents "
                    "(id, employer_company_id, document_type, file_url, status, created_at, updated_at) "
                    "VALUES (:id, :company_id, 'business_registration_certificate', :file_url, 'pending_review', :now, :now)"
                ),
                {"id": str(uuid.uuid4()), "company_id": str(company_id), "file_url": url, "now": now},
            )

    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.alter_column('hiring_status', existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column('accreditation_status', existing_type=sa.String(length=20), nullable=False)
        batch_op.drop_constraint('ck_employer_verification_status', type_='check')
        batch_op.drop_column('verification_status')
        batch_op.drop_column('verification_remarks')
        batch_op.drop_column('document_urls')
        batch_op.create_check_constraint(
            'ck_employer_accreditation_status',
            "accreditation_status IN ('not_submitted', 'pending_review', 'accredited', 'rejected', 'suspended')",
        )
        batch_op.create_check_constraint('ck_employer_business_type', "business_type IN ('corporation', 'sole_proprietorship', 'cooperative')")
        batch_op.create_check_constraint('ck_employer_company_size', "company_size IN ('micro', 'small', 'medium', 'large')")
        batch_op.create_check_constraint('ck_employer_hiring_status', "hiring_status IN ('actively_hiring', 'not_hiring', 'paused')")


def downgrade():
    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.drop_constraint('ck_employer_hiring_status', type_='check')
        batch_op.drop_constraint('ck_employer_company_size', type_='check')
        batch_op.drop_constraint('ck_employer_business_type', type_='check')
        batch_op.drop_constraint('ck_employer_accreditation_status', type_='check')
        batch_op.add_column(sa.Column('document_urls', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('verification_remarks', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('verification_status', sa.String(length=20), nullable=True))

    op.execute(
        "UPDATE employer_companies SET verification_status = CASE accreditation_status "
        "WHEN 'accredited' THEN 'verified' WHEN 'suspended' THEN 'suspended' ELSE 'unverified' END"
    )
    op.execute("UPDATE employer_companies SET verification_remarks = accreditation_remarks")
    op.execute("UPDATE employer_companies SET document_urls = '[]'::json")

    with op.batch_alter_table('employer_companies', schema=None) as batch_op:
        batch_op.alter_column('verification_status', existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column('document_urls', existing_type=sa.JSON(), nullable=False)
        batch_op.create_check_constraint('ck_employer_verification_status', "verification_status IN ('unverified', 'verified', 'suspended')")

        batch_op.drop_column('accreditation_remarks')
        batch_op.drop_column('accreditation_status')
        batch_op.drop_column('x_url')
        batch_op.drop_column('instagram_url')
        batch_op.drop_column('linkedin_url')
        batch_op.drop_column('facebook_url')
        batch_op.drop_column('employment_types_offered')
        batch_op.drop_column('work_setup')
        batch_op.drop_column('preferred_hiring_areas')
        batch_op.drop_column('hiring_status')
        batch_op.drop_column('rep_signature_url')
        batch_op.drop_column('rep_gov_id_number')
        batch_op.drop_column('rep_contact_number')
        batch_op.drop_column('rep_email')
        batch_op.drop_column('rep_position')
        batch_op.drop_column('rep_name')
        batch_op.drop_column('zip_code')
        batch_op.drop_column('street_address')
        batch_op.drop_column('barangay_name')
        batch_op.drop_column('barangay_code')
        batch_op.drop_column('city_municipality_name')
        batch_op.drop_column('city_municipality_code')
        batch_op.drop_column('province_name')
        batch_op.drop_column('province_code')
        batch_op.drop_column('region_name')
        batch_op.drop_column('region_code')
        batch_op.drop_column('philgeps_registration_no')
        batch_op.drop_column('cda_number')
        batch_op.drop_column('dti_number')
        batch_op.drop_column('sec_number')
        batch_op.drop_column('bir_tin')
        batch_op.drop_column('alt_contact_number')
        batch_op.drop_column('company_email')
        batch_op.drop_column('company_size')
        batch_op.drop_column('num_employees')
        batch_op.drop_column('year_established')
        batch_op.drop_column('nature_of_business')
        batch_op.drop_column('business_type')
        batch_op.drop_column('trade_name')
