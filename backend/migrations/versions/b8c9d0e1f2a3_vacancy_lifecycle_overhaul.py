"""Phase 6: Vacancy lifecycle overhaul (draft/pending/approved/rejected/published/
suspended/closed/filled) + full posting form fields + categories + screening questions

Replaces the 4-state (pending|active|rejected|closed) status enum with the full
8-state lifecycle from services/vacancy_state_service.py — "active" becomes
"published". Existing rows are data-migrated: pending->pending, active->published
(published_at backfilled from approved_at), rejected->rejected, closed->closed.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'vacancy_categories',
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    with op.batch_alter_table('vacancies', schema=None) as batch_op:
        # Basic
        batch_op.add_column(sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('department', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('vacancy_no', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('work_arrangement', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('schedule', sa.String(length=255), nullable=True))

        # Description
        batch_op.add_column(sa.Column('summary', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('responsibilities', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('daily_tasks', sa.Text(), nullable=True))

        # Qualifications
        batch_op.add_column(sa.Column('education_level', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('course', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('min_experience_years', sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column('fresh_grad_ok', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('required_skills', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('required_certifications', sa.JSON(), nullable=True))

        # Salary
        batch_op.add_column(sa.Column('hide_salary', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('benefits', sa.JSON(), nullable=True))

        # Location (structured address)
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

        # Hiring Details
        batch_op.add_column(sa.Column('posting_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('application_deadline', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('expected_start_date', sa.Date(), nullable=True))

        # Applicant Preferences
        batch_op.add_column(sa.Column('pref_age_min', sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column('pref_age_max', sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column('pref_gender', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('pref_civil_status', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('pref_languages', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('fresh_grad_friendly', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('pwd_friendly', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('senior_citizen_friendly', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('ofw_friendly', sa.Boolean(), nullable=True))

        # Required Documents (applicant-facing)
        batch_op.add_column(sa.Column('required_applicant_documents', sa.JSON(), nullable=True))

        # Contact Person
        batch_op.add_column(sa.Column('contact_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('contact_email', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('contact_number', sa.String(length=30), nullable=True))

        # Additional Information
        batch_op.add_column(sa.Column('culture_description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('career_growth_description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('additional_notes', sa.Text(), nullable=True))

        # Smart features
        batch_op.add_column(sa.Column('is_template', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('template_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('duplicated_from_id', postgresql.UUID(as_uuid=True), nullable=True))

        # Status machine support
        batch_op.add_column(sa.Column('suspended_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('filled_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # ### backfill boolean defaults for existing rows ###
    op.execute(
        "UPDATE vacancies SET fresh_grad_ok = false, hide_salary = false, fresh_grad_friendly = false, "
        "pwd_friendly = false, senior_citizen_friendly = false, ofw_friendly = false, is_template = false"
    )

    with op.batch_alter_table('vacancies', schema=None) as batch_op:
        batch_op.alter_column('fresh_grad_ok', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('hide_salary', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('fresh_grad_friendly', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('pwd_friendly', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('senior_citizen_friendly', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('ofw_friendly', existing_type=sa.Boolean(), nullable=False)
        batch_op.alter_column('is_template', existing_type=sa.Boolean(), nullable=False)

        # Drop the old 4-state constraint *before* writing the new status values below —
        # otherwise the old CHECK rejects 'published' as an illegal value mid-migration.
        batch_op.drop_constraint('ck_vacancy_status', type_='check')
        batch_op.create_check_constraint('ck_vacancy_work_arrangement', "work_arrangement IN ('onsite', 'remote', 'hybrid')")
        batch_op.create_foreign_key('vacancies_category_id_fkey', 'vacancy_categories', ['category_id'], ['id'])
        batch_op.create_foreign_key('vacancies_duplicated_from_id_fkey', 'vacancies', ['duplicated_from_id'], ['id'])

    # ### data migration: old 4-state status -> new 8-state status ###
    op.execute("UPDATE vacancies SET published_at = approved_at WHERE status = 'active'")
    op.execute("UPDATE vacancies SET status = 'published' WHERE status = 'active'")

    with op.batch_alter_table('vacancies', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_vacancy_status',
            "status IN ('draft', 'pending', 'approved', 'rejected', 'published', 'suspended', 'closed', 'filled')",
        )

    op.create_table(
        'vacancy_screening_questions',
        sa.Column('vacancy_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_text', sa.String(length=500), nullable=False),
        sa.Column('question_type', sa.String(length=20), nullable=False),
        sa.Column('options', sa.JSON(), nullable=True),
        sa.Column('is_required', sa.Boolean(), nullable=True),
        sa.Column('display_order', sa.SmallInteger(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("question_type IN ('text', 'yes_no', 'multiple_choice')", name='ck_screening_question_type'),
        sa.ForeignKeyConstraint(['vacancy_id'], ['vacancies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('vacancy_screening_questions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_vacancy_screening_questions_vacancy_id'), ['vacancy_id'], unique=False)


def downgrade():
    with op.batch_alter_table('vacancy_screening_questions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_vacancy_screening_questions_vacancy_id'))
    op.drop_table('vacancy_screening_questions')

    with op.batch_alter_table('vacancies', schema=None) as batch_op:
        batch_op.drop_constraint('vacancies_duplicated_from_id_fkey', type_='foreignkey')
        batch_op.drop_constraint('vacancies_category_id_fkey', type_='foreignkey')
        batch_op.drop_constraint('ck_vacancy_work_arrangement', type_='check')
        # Drop the 8-state constraint *before* writing 'active' back — otherwise it
        # rejects 'active' as an illegal value under the constraint being replaced.
        batch_op.drop_constraint('ck_vacancy_status', type_='check')

    op.execute("UPDATE vacancies SET status = 'active' WHERE status = 'published'")

    with op.batch_alter_table('vacancies', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_vacancy_status', "status IN ('pending', 'active', 'rejected', 'closed')")

        batch_op.drop_column('deleted_at')
        batch_op.drop_column('filled_at')
        batch_op.drop_column('published_at')
        batch_op.drop_column('submitted_at')
        batch_op.drop_column('suspended_reason')
        batch_op.drop_column('duplicated_from_id')
        batch_op.drop_column('template_name')
        batch_op.drop_column('is_template')
        batch_op.drop_column('additional_notes')
        batch_op.drop_column('career_growth_description')
        batch_op.drop_column('culture_description')
        batch_op.drop_column('contact_number')
        batch_op.drop_column('contact_email')
        batch_op.drop_column('contact_name')
        batch_op.drop_column('required_applicant_documents')
        batch_op.drop_column('ofw_friendly')
        batch_op.drop_column('senior_citizen_friendly')
        batch_op.drop_column('pwd_friendly')
        batch_op.drop_column('fresh_grad_friendly')
        batch_op.drop_column('pref_languages')
        batch_op.drop_column('pref_civil_status')
        batch_op.drop_column('pref_gender')
        batch_op.drop_column('pref_age_max')
        batch_op.drop_column('pref_age_min')
        batch_op.drop_column('expected_start_date')
        batch_op.drop_column('application_deadline')
        batch_op.drop_column('posting_date')
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
        batch_op.drop_column('benefits')
        batch_op.drop_column('hide_salary')
        batch_op.drop_column('required_certifications')
        batch_op.drop_column('required_skills')
        batch_op.drop_column('fresh_grad_ok')
        batch_op.drop_column('min_experience_years')
        batch_op.drop_column('course')
        batch_op.drop_column('education_level')
        batch_op.drop_column('daily_tasks')
        batch_op.drop_column('responsibilities')
        batch_op.drop_column('summary')
        batch_op.drop_column('schedule')
        batch_op.drop_column('work_arrangement')
        batch_op.drop_column('vacancy_no')
        batch_op.drop_column('department')
        batch_op.drop_column('category_id')

    op.drop_table('vacancy_categories')
