"""Who may see report media, and short-lived signed links for administrators.

* Photos become public only after an admin verifies (or resolves) the report.
* Videos are never public (they are not stripped of metadata) - admins only.
* Admin pages load media through signed URLs (HMAC with SECRET_KEY, expiring), because
  <img>/<video> tags cannot send an Authorization header.
"""

from __future__ import annotations

import hashlib
import hmac
import time

from ..config import get_settings

PUBLIC_MEDIA_STATUSES = ("verified", "resolved")
MEDIA_KINDS = ("photo", "video")


def _signature(report_id: int, kind: str, exp: int) -> str:
    key = get_settings().secret_key.encode()
    return hmac.new(key, f"media:{report_id}:{kind}:{exp}".encode(), hashlib.sha256).hexdigest()


def signed_media_url(report_id: int, kind: str, ttl_seconds: int | None = None) -> str:
    ttl = ttl_seconds if ttl_seconds is not None else get_settings().media_url_ttl_seconds
    exp = int(time.time()) + ttl
    return f"/api/admin/media/{report_id}/{kind}?exp={exp}&sig={_signature(report_id, kind, exp)}"


def verify_media_signature(report_id: int, kind: str, exp: int, sig: str) -> bool:
    if exp < time.time():
        return False
    return hmac.compare_digest(sig, _signature(report_id, kind, exp))


def public_photo_url(report) -> str | None:
    if report.photo_filename and report.status in PUBLIC_MEDIA_STATUSES:
        return f"/api/reports/{report.id}/photo"
    return None
