"""Data cleanup: dedupe duplicate 'hired' applications at the same employer,
and duplicate/mislinked referral letters.

Two shapes of duplication found in production data:

1. A jobseeker with more than one Application.status='hired' at the same
   employer_company (different vacancies). For each such group we keep the
   application with real interview history (the legitimate hire) and revert
   the other(s) to 'rejected', recording why in ApplicationStatusHistory and
   removing their now-invalid EmploymentRecord row(s). The Application row,
   its interviews/offers/messages/referral link, and its full status history
   are left intact — only the incorrect terminal status is corrected.

2. ReferralLetter rows with duplicate/mislinked application_id: Application.
   referral_letter is declared uselist=False (models/application.py) but no
   DB constraint ever enforced "at most one letter per application" after
   migration a3b4c5d6e7f8 dropped the old plain unique(application_id)
   constraint (it had to, since a letter can now exist before the
   application it will attach to). blueprints/employer_referrals.py's
   accept_referral() could re-attach a second already-approved referral to
   an application that already had one. We detach the extra link(s), then
   dedupe any remaining simultaneously-active (requested/approved) referral
   letters for the same jobseeker+vacancy (or general referral) down to one,
   preferring the one actually linked to a used application. Finally we add
   a partial unique index so this can't recur.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-07-21 00:00:00.000000

"""
from datetime import datetime, timezone
import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    now = datetime.now(timezone.utc)

    # ---- 1. Duplicate 'hired' applications at the same employer ----
    dup_apps = bind.execute(sa.text('''
        WITH ranked AS (
            SELECT a.id,
                   ROW_NUMBER() OVER (
                       PARTITION BY a.jobseeker_profile_id, v.employer_company_id
                       ORDER BY (EXISTS (SELECT 1 FROM interviews i WHERE i.application_id = a.id)) DESC,
                                a.updated_at ASC
                   ) AS rn
            FROM applications a
            JOIN vacancies v ON a.vacancy_id = v.id
            WHERE a.status = 'hired'
        )
        SELECT id FROM ranked WHERE rn > 1
    ''')).fetchall()

    for (app_id,) in dup_apps:
        bind.execute(sa.text('''
            INSERT INTO application_status_history (id, application_id, from_status, to_status, changed_by, note, created_at, updated_at)
            VALUES (:id, :app_id, 'hired', 'rejected', NULL,
                    'System cleanup: duplicate Hired record for this employer, superseded by another application.', :now, :now)
        '''), {"id": str(uuid.uuid4()), "app_id": app_id, "now": now})
        bind.execute(
            sa.text("UPDATE applications SET status = 'rejected', updated_at = :now WHERE id = :app_id"),
            {"app_id": app_id, "now": now},
        )
        # employment_status_history rows cascade-delete via their FK's ondelete='CASCADE'.
        bind.execute(sa.text("DELETE FROM employment_records WHERE application_id = :app_id"), {"app_id": app_id})

    # ---- 2. Detach referral letters wrongly double-linked to the same application ----
    dup_links = bind.execute(sa.text('''
        WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at ASC) AS rn
            FROM referral_letters
            WHERE application_id IS NOT NULL
        )
        SELECT id FROM ranked WHERE rn > 1
    ''')).fetchall()
    for (rl_id,) in dup_links:
        bind.execute(
            sa.text("UPDATE referral_letters SET application_id = NULL, updated_at = :now WHERE id = :id"),
            {"id": rl_id, "now": now},
        )

    # ---- 3. Dedupe remaining simultaneously-active referral letters per jobseeker+vacancy(/general) ----
    dup_referrals = bind.execute(sa.text('''
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY jobseeker_profile_id, COALESCE(vacancy_id::text, 'general')
                       ORDER BY (application_id IS NOT NULL) DESC, created_at DESC
                   ) AS rn
            FROM referral_letters
            WHERE status IN ('requested', 'approved')
        )
        SELECT id FROM ranked WHERE rn > 1
    ''')).fetchall()
    for (rl_id,) in dup_referrals:
        bind.execute(sa.text("DELETE FROM referral_letters WHERE id = :id"), {"id": rl_id})

    # ---- 4. Guard against this recurring: at most one referral letter per application ----
    op.create_index(
        'ux_referral_letters_application_id', 'referral_letters', ['application_id'],
        unique=True, postgresql_where=sa.text('application_id IS NOT NULL'),
    )


def downgrade():
    op.drop_index('ux_referral_letters_application_id', table_name='referral_letters')
    # The data corrections (status reverts, detaches, deleted duplicate rows) are not reversible.
