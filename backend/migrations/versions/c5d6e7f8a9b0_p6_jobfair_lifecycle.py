"""Phase 6 (system upgrade): job fair lifecycle (draft/published/archived), rich event
fields, registration numbers, booth management fields

Data migration: existing 'upcoming' fairs become 'published' (the "Upcoming" chip is
now derived from published + future event_date); published_at backfilled from
created_at. Existing registrations get sequential JF-<year>-<seq> numbers; existing
booths become 'confirmed'.

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-07-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c5d6e7f8a9b0'
down_revision = 'b4c5d6e7f8a9'
branch_labels = None
depends_on = None

NEW_STATUSES = "'draft', 'published', 'ongoing', 'completed', 'cancelled', 'archived'"


def upgrade():
    with op.batch_alter_table('jobfairs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('banner_url', sa.String(length=1000), nullable=True))
        batch_op.add_column(sa.Column('municipality', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('end_time', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('registration_deadline', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('contact_person', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('contact_number', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('requirements', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('attachments', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
        # Drop before the data migration writes 'published' (illegal under the old CHECK).
        batch_op.drop_constraint('ck_jobfair_status', type_='check')

    op.execute("UPDATE jobfairs SET published_at = created_at WHERE status IN ('upcoming', 'ongoing', 'completed')")
    op.execute("UPDATE jobfairs SET status = 'published' WHERE status = 'upcoming'")

    with op.batch_alter_table('jobfairs', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_jobfair_status', f"status IN ({NEW_STATUSES})")

    with op.batch_alter_table('jobfair_registrations', schema=None) as batch_op:
        batch_op.add_column(sa.Column('registration_number', sa.String(length=20), nullable=True))

    op.execute(
        "UPDATE jobfair_registrations r SET registration_number = "
        "'JF-' || to_char(r.created_at, 'YYYY') || '-' || lpad(t.rn::text, 5, '0') "
        "FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM jobfair_registrations) t "
        "WHERE t.id = r.id"
    )

    with op.batch_alter_table('jobfair_registrations', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_registration_number', ['registration_number'])

    with op.batch_alter_table('jobfair_booths', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('booth_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('description', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('materials', sa.JSON(), nullable=True))

    op.execute("UPDATE jobfair_booths SET status = 'confirmed' WHERE status IS NULL")

    with op.batch_alter_table('jobfair_booths', schema=None) as batch_op:
        batch_op.alter_column('status', existing_type=sa.String(length=20), nullable=False)
        batch_op.create_check_constraint('ck_booth_status', "status IN ('pending', 'confirmed', 'cancelled')")


def downgrade():
    with op.batch_alter_table('jobfair_booths', schema=None) as batch_op:
        batch_op.drop_constraint('ck_booth_status', type_='check')
        batch_op.drop_column('materials')
        batch_op.drop_column('description')
        batch_op.drop_column('booth_name')
        batch_op.drop_column('status')

    with op.batch_alter_table('jobfair_registrations', schema=None) as batch_op:
        batch_op.drop_constraint('uq_registration_number', type_='unique')
        batch_op.drop_column('registration_number')

    with op.batch_alter_table('jobfairs', schema=None) as batch_op:
        batch_op.drop_constraint('ck_jobfair_status', type_='check')

    op.execute("UPDATE jobfairs SET status = 'upcoming' WHERE status IN ('published', 'draft', 'archived')")

    with op.batch_alter_table('jobfairs', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_jobfair_status', "status IN ('upcoming', 'ongoing', 'completed', 'cancelled')")
        batch_op.drop_column('published_at')
        batch_op.drop_column('attachments')
        batch_op.drop_column('requirements')
        batch_op.drop_column('contact_number')
        batch_op.drop_column('contact_person')
        batch_op.drop_column('registration_deadline')
        batch_op.drop_column('end_time')
        batch_op.drop_column('municipality')
        batch_op.drop_column('banner_url')
