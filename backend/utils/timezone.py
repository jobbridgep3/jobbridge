from datetime import datetime, timedelta

import pytz

MANILA_TZ = pytz.timezone("Asia/Manila")


def now_manila() -> datetime:
    """Current time as a timezone-aware Asia/Manila datetime. Use for all DB writes."""
    return datetime.now(pytz.utc).astimezone(MANILA_TZ)


def to_manila(dt: datetime) -> datetime:
    """Convert any datetime (naive=UTC assumed, or aware) to Asia/Manila."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    return dt.astimezone(MANILA_TZ)


def iso_manila(dt: datetime) -> str | None:
    """ISO-8601 string in Manila time, for JSON API responses."""
    converted = to_manila(dt)
    return converted.isoformat() if converted else None


def parse_manila(value: str) -> datetime:
    """Parse a naive 'YYYY-MM-DDTHH:MM' wall-clock string (as sent by the
    frontend date/time pickers) as Asia/Manila local time. Use for all
    interview-scheduling input."""
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        return MANILA_TZ.localize(dt)
    return dt.astimezone(MANILA_TZ)


def manila_day_bounds(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    """Converts plain 'YYYY-MM-DD' date_from/date_to query params into Manila-midnight-
    anchored, timezone-aware boundaries suitable for >=/< comparisons against a
    DateTime(timezone=True) column. Comparing a bare date directly against a TIMESTAMPTZ
    column lets Postgres cast it using the DB session's timezone (UTC here, since no
    session ever pins Asia/Manila) — silently shifting the intended Manila day boundary by
    8 hours and excluding early-morning Manila records from a "today" filter. date_to's
    boundary is exclusive (< the start of the next Manila day)."""
    start = parse_manila(f"{date_from}T00:00:00") if date_from else None
    end = parse_manila(f"{date_to}T00:00:00") + timedelta(days=1) if date_to else None
    return start, end
