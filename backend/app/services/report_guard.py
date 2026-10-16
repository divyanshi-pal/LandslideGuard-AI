"""Duplicate-submission detection and a simple per-client rate limit for new reports."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CitizenReport

# Same incident type, same text and practically the same spot within this window = a resubmission.
RESUBMIT_WINDOW = timedelta(minutes=10)
RESUBMIT_DEGREES = 0.0005  # ~50 m


def find_resubmission(
    db: Session,
    *,
    client_submission_id: str | None,
    category: str,
    description: str,
    latitude: float,
    longitude: float,
) -> CitizenReport | None:
    """Return an existing report if this request repeats one (double click, retry, refresh)."""
    if client_submission_id:
        existing = db.scalar(
            select(CitizenReport).where(CitizenReport.client_submission_id == client_submission_id)
        )
        if existing is not None:
            return existing
    since = datetime.now(timezone.utc) - RESUBMIT_WINDOW
    return db.scalar(
        select(CitizenReport)
        .where(
            CitizenReport.category == category,
            CitizenReport.description == description,
            CitizenReport.latitude.between(latitude - RESUBMIT_DEGREES, latitude + RESUBMIT_DEGREES),
            CitizenReport.longitude.between(longitude - RESUBMIT_DEGREES, longitude + RESUBMIT_DEGREES),
            CitizenReport.created_at >= since,
        )
        .order_by(CitizenReport.id.desc())
        .limit(1)
    )


def find_same_photo(db: Session, sha256: str) -> int | None:
    """Earliest report that used exactly the same photo file (flagged for the admin, not rejected)."""
    return db.scalar(
        select(CitizenReport.id).where(CitizenReport.photo_sha256 == sha256).order_by(CitizenReport.id).limit(1)
    )


class RateLimiter:
    """Sliding one-hour window per key, in memory. Keys (client IPs) are never stored in the database."""

    def __init__(self, limit_per_hour: int, window_seconds: float = 3600.0):
        self.limit = limit_per_hour
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, now: float | None = None) -> bool:
        if self.limit <= 0:
            return True
        now = time.monotonic() if now is None else now
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True
