"""Phase 4 (system upgrade): jobseeker-requested referral letter flow

Redesigns referral_letters in place:
- jobseeker_profile_id (NOT NULL, backfilled from the linked application)
- vacancy_id (nullable; backfilled), application_id becomes nullable + non-unique
  (a letter can exist before the application it will attach to)
- status requested/approved/rejected (existing rows backfilled as 'approved'),
  reason, requested_by (null = staff-issued), reviewed_by (backfilled from
  generated_by), rejection_reason
- generated_by and pdf_url relaxed to nullable (requested rows have no PDF yet)

Order matters: add nullable columns -> backfill -> tighten constraints.

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a3b4c5d6e7f8'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add the new columns as nullable so existing rows are untouched.
    with op.batch_alter_table('referral_letters', schema=None) as batch_op:
        batch_op.add_column(sa.Column('jobseeker_profile_id', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('vacancy_id', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('requested_by', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True))
        batch_op.add_column(sa.Column('rejection_reason', sa.Text(), nullable=True))

    # 2. Backfill from the linked application (every legacy row has one).
    op.execute(
        "UPDATE referral_letters rl SET "
        "jobseeker_profile_id = a.jobseeker_profile_id, "
        "vacancy_id = a.vacancy_id, "
        "status = 'approved', "
        "reviewed_by = rl.generated_by "
        "FROM applications a WHERE a.id = rl.application_id"
    )
    # Safety net: orphan rows (shouldn't exist) still need NOT NULL satisfied.
    op.execute("DELETE FROM referral_letters WHERE jobseeker_profile_id IS NULL")

    # 3. Tighten: NOT NULLs, relax legacy NOT NULLs, swap unique for plain index.
    with op.batch_alter_table('referral_letters', schema=None) as batch_op:
        batch_op.alter_column('jobseeker_profile_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
        batch_op.alter_column('status', existing_type=sa.String(length=20), nullable=False)
        batch_op.alter_column('application_id', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
        batch_op.alter_column('generated_by', existing_type=postgresql.UUID(as_uuid=True), nullable=True)
        batch_op.alter_column('pdf_url', existing_type=sa.String(length=1000), nullable=True)
        batch_op.drop_constraint('referral_letters_application_id_key', type_='unique')
        batch_op.create_index('ix_referral_letters_application_id', ['application_id'], unique=False)
        batch_op.create_index('ix_referral_letters_jobseeker_profile_id', ['jobseeker_profile_id'], unique=False)
        batch_op.create_foreign_key('referral_letters_jobseeker_profile_id_fkey', 'jobseeker_profiles', ['jobseeker_profile_id'], ['id'])
        batch_op.create_foreign_key('referral_letters_vacancy_id_fkey', 'vacancies', ['vacancy_id'], ['id'])
        batch_op.create_foreign_key('referral_letters_requested_by_fkey', 'users', ['requested_by'], ['id'])
        batch_op.create_foreign_key('referral_letters_reviewed_by_fkey', 'users', ['reviewed_by'], ['id'])
        batch_op.create_check_constraint('ck_referral_status', "status IN ('requested', 'approved', 'rejected')")


def downgrade():
    # Rows without an application or PDF can't exist under the legacy schema.
    op.execute("DELETE FROM referral_letters WHERE application_id IS NULL OR pdf_url IS NULL OR generated_by IS NULL")
    # The legacy unique(application_id) tolerates at most one letter per application.
    op.execute(
        "DELETE FROM referral_letters rl USING referral_letters newer "
        "WHERE rl.application_id = newer.application_id AND rl.created_at < newer.created_at"
    )

    with op.batch_alter_table('referral_letters', schema=None) as batch_op:
        batch_op.drop_constraint('ck_referral_status', type_='check')
        batch_op.drop_constraint('referral_letters_reviewed_by_fkey', type_='foreignkey')
        batch_op.drop_constraint('referral_letters_requested_by_fkey', type_='foreignkey')
        batch_op.drop_constraint('referral_letters_vacancy_id_fkey', type_='foreignkey')
        batch_op.drop_constraint('referral_letters_jobseeker_profile_id_fkey', type_='foreignkey')
        batch_op.drop_index('ix_referral_letters_jobseeker_profile_id')
        batch_op.drop_index('ix_referral_letters_application_id')
        batch_op.create_unique_constraint('referral_letters_application_id_key', ['application_id'])
        batch_op.alter_column('pdf_url', existing_type=sa.String(length=1000), nullable=False)
        batch_op.alter_column('generated_by', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
        batch_op.alter_column('application_id', existing_type=postgresql.UUID(as_uuid=True), nullable=False)
        batch_op.drop_column('rejection_reason')
        batch_op.drop_column('reviewed_by')
        batch_op.drop_column('requested_by')
        batch_op.drop_column('reason')
        batch_op.drop_column('status')
        batch_op.drop_column('vacancy_id')
        batch_op.drop_column('jobseeker_profile_id')
