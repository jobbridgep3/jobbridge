"""Data fix: backfill jobfair_registration_counters from existing registration
numbers.

f15e611995ba (the prior "Job Fair becomes scheduling/registration-only"
migration) introduced jobfair_registration_counters as an atomic per-year
sequence for JobFairRegistration.registration_number, but never seeded it
from the registration numbers that already existed (JF-2026-00001 through
JF-2026-00016 in production at the time). Since the counter table started
empty, next_registration_number() always began each year fresh at seq=1,
immediately colliding with the pre-existing JF-2026-00001 row on the very
next registration attempt — every jobseeker registration has since failed
with a uq_registration_number IntegrityError, which blueprints/jobfair.py's
register_jobfair() mis-reported to the user as "Already registered for this
job fair." (its except IntegrityError handler assumed only one possible
cause). This migration is the data-side half of the fix; the other half
(register_jobfair's error handling) is a code change in the same deploy.

Idempotent and additive only: parses every "JF-<year>-<seq>" registration
number, takes the max seq per year, and upserts each year's counter to at
least (max seq + 1) — never lowers an existing counter value.

Revision ID: 11f31a29c940
Revises: f15e611995ba
Create Date: 2026-08-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '11f31a29c940'
down_revision = 'f15e611995ba'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    bind.execute(sa.text('''
        INSERT INTO jobfair_registration_counters (year, next_seq)
        SELECT year, max_seq + 1 FROM (
            SELECT (m[1])::int AS year, MAX((m[2])::int) AS max_seq
            FROM (
                SELECT regexp_match(registration_number, '^JF-(\\d+)-(\\d+)$') AS m
                FROM jobfair_registrations
                WHERE registration_number IS NOT NULL
            ) parsed
            WHERE m IS NOT NULL
            GROUP BY m[1]
        ) yearly
        ON CONFLICT (year) DO UPDATE
            SET next_seq = GREATEST(jobfair_registration_counters.next_seq, EXCLUDED.next_seq)
    '''))


def downgrade():
    # Backfilling a counter forward is not meaningfully reversible (we can't
    # know whether a prior value existed before this upgrade ran) — no-op,
    # matching the convention in f3a4b5c6d7e8_dedupe_hires_referrals.py.
    pass
