"""Fix FK constraints blocking user deletion

Root cause of "cannot delete jobseeker/employer" in production: audit_trail.user_id,
otp_codes.user_id, and notifications.user_id all reference users.id with no ON
DELETE behavior (defaults to RESTRICT in Postgres) — and virtually every real
account has at least one row in each of these tables (registration OTP, login/
registration audit entries, verification notifications), so the new hard-delete
feature could only ever succeed on accounts created directly in the DB, never on
a real one.

- audit_trail.user_id -> SET NULL: the row is a historical record that must
  survive the user's deletion (it already denormalizes user_email/user_role onto
  the row for exactly this reason), it just loses the live FK link.
- otp_codes.user_id / notifications.user_id -> CASCADE: both are NOT NULL and
  meaningless without the user (a one-time code or an inbox notification has no
  purpose once its owner is gone), so their rows should be deleted along with it.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-08 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('audit_trail_user_id_fkey', 'audit_trail', type_='foreignkey')
    op.create_foreign_key('audit_trail_user_id_fkey', 'audit_trail', 'users', ['user_id'], ['id'], ondelete='SET NULL')

    op.drop_constraint('otp_codes_user_id_fkey', 'otp_codes', type_='foreignkey')
    op.create_foreign_key('otp_codes_user_id_fkey', 'otp_codes', 'users', ['user_id'], ['id'], ondelete='CASCADE')

    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
    op.create_foreign_key('notifications_user_id_fkey', 'notifications', 'users', ['user_id'], ['id'], ondelete='CASCADE')


def downgrade():
    op.drop_constraint('audit_trail_user_id_fkey', 'audit_trail', type_='foreignkey')
    op.create_foreign_key('audit_trail_user_id_fkey', 'audit_trail', 'users', ['user_id'], ['id'])

    op.drop_constraint('otp_codes_user_id_fkey', 'otp_codes', type_='foreignkey')
    op.create_foreign_key('otp_codes_user_id_fkey', 'otp_codes', 'users', ['user_id'], ['id'])

    op.drop_constraint('notifications_user_id_fkey', 'notifications', type_='foreignkey')
    op.create_foreign_key('notifications_user_id_fkey', 'notifications', 'users', ['user_id'], ['id'])
