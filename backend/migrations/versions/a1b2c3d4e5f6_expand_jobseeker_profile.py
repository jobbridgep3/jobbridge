"""Expand jobseeker profile: personal, employment, skills, documents

Revision ID: a1b2c3d4e5f6
Revises: 03d940699a42
Create Date: 2026-07-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '03d940699a42'
branch_labels = None
depends_on = None


def upgrade():
    # ### jobseeker_profiles: personal, employment, skills, verification ###
    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('gender', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('civil_status', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('nationality', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('barangay', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('municipality', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('province', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('profile_picture_url', sa.String(length=1000), nullable=True))
        batch_op.add_column(sa.Column('employment_status', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('preferred_job_position', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('preferred_industry', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('preferred_work_location', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('expected_salary', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('employment_type', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('technical_skills', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('soft_skills', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('languages_spoken', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('certifications', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('verification_remarks', sa.Text(), nullable=True))

    # ### educations: attainment level, honors; course/program becomes optional ###
    with op.batch_alter_table('educations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('attainment_level', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('honors', sa.String(length=255), nullable=True))
        batch_op.alter_column('degree', existing_type=sa.String(length=255), nullable=True)

    # ### jobseeker_documents: multi-type document uploads ###
    op.create_table(
        'jobseeker_documents',
        sa.Column('profile_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('file_url', sa.String(length=1000), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "document_type IN ('government_id', 'id_photo_2x2', 'diploma', 'training_certificate', 'certificate_of_employment')",
            name='ck_jobseeker_document_type',
        ),
        sa.ForeignKeyConstraint(['profile_id'], ['jobseeker_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('jobseeker_documents', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_jobseeker_documents_profile_id'), ['profile_id'], unique=False)

    # ### data migration: carry forward existing flat `skills` into `technical_skills` ###
    op.execute("UPDATE jobseeker_profiles SET technical_skills = skills WHERE skills IS NOT NULL")


def downgrade():
    with op.batch_alter_table('jobseeker_documents', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_jobseeker_documents_profile_id'))
    op.drop_table('jobseeker_documents')

    with op.batch_alter_table('educations', schema=None) as batch_op:
        batch_op.alter_column('degree', existing_type=sa.String(length=255), nullable=False)
        batch_op.drop_column('honors')
        batch_op.drop_column('attainment_level')

    with op.batch_alter_table('jobseeker_profiles', schema=None) as batch_op:
        batch_op.drop_column('verification_remarks')
        batch_op.drop_column('certifications')
        batch_op.drop_column('languages_spoken')
        batch_op.drop_column('soft_skills')
        batch_op.drop_column('technical_skills')
        batch_op.drop_column('employment_type')
        batch_op.drop_column('expected_salary')
        batch_op.drop_column('preferred_work_location')
        batch_op.drop_column('preferred_industry')
        batch_op.drop_column('preferred_job_position')
        batch_op.drop_column('employment_status')
        batch_op.drop_column('profile_picture_url')
        batch_op.drop_column('province')
        batch_op.drop_column('municipality')
        batch_op.drop_column('barangay')
        batch_op.drop_column('nationality')
        batch_op.drop_column('civil_status')
        batch_op.drop_column('gender')
