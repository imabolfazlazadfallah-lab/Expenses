"""Shared application clock: use Tehran's calendar date for user-entered dates."""
from datetime import datetime, timedelta, timezone, date

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - older Python fallback
    ZoneInfo = None  # type: ignore[assignment,misc]

# Iran currently uses UTC+03:30 year-round. This fallback is especially useful
# on Windows deployments where IANA timezone data may not be installed.
_TEHRAN_FALLBACK = timezone(timedelta(hours=3, minutes=30), name="Asia/Tehran")


def app_now() -> datetime:
    if ZoneInfo is not None:
        try:
            return datetime.now(ZoneInfo("Asia/Tehran"))
        except Exception:
            pass
    return datetime.now(_TEHRAN_FALLBACK)


def app_today() -> date:
    """One canonical business date shared by parser, validator and APIs."""
    return app_now().date()
