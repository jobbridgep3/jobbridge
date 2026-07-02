from datetime import datetime

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
