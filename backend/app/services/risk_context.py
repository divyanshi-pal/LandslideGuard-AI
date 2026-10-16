"""What can honestly be said about landslide risk at an arbitrary point in India.

The risk index exists only for the monitored towns in Northeast India, and even there the
terrain attributes are estimates. For any other place we have no reliable local terrain,
weather or landslide-history data, so we say so instead of producing a number.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Location
from ..schemas import _as_utc
from .geo import NE_MONITORING_BOUNDS, haversine_km, in_bounds
from .queries import latest_assessments

NEARBY_KM = 25.0
UNAVAILABLE_MESSAGE = (
    "Risk assessment unavailable: there is no reliable local terrain, weather or landslide-history "
    "data for this location in LandslideGuard. Reports from here are still recorded and reviewed."
)


def risk_context(db: Session, lat: float, lon: float) -> dict:
    if not in_bounds(lat, lon, NE_MONITORING_BOUNDS):
        return {"status": "unavailable", "kind": "insufficient_data", "message": UNAVAILABLE_MESSAGE}

    locations = list(db.scalars(select(Location)))
    if not locations:
        return {"status": "unavailable", "kind": "insufficient_data", "message": UNAVAILABLE_MESSAGE}
    nearest = min(locations, key=lambda l: haversine_km(lat, lon, l.latitude, l.longitude))
    distance = haversine_km(lat, lon, nearest.latitude, nearest.longitude)
    latest = latest_assessments(db).get(nearest.id)
    if distance > NEARBY_KM or latest is None:
        return {"status": "unavailable", "kind": "insufficient_data", "message": UNAVAILABLE_MESSAGE}

    return {
        "status": "nearby_monitored",
        "kind": "model_estimate",
        "location": {"id": nearest.id, "name": nearest.name, "district": nearest.district, "state": nearest.state},
        "distance_km": round(distance, 1),
        "level": latest.level,
        "score": latest.score,
        "data_source": latest.data_source,
        "terrain_source": nearest.attributes_source,
        "assessed_at": _as_utc(latest.created_at).isoformat(),
        "message": (
            f"Model estimate for the nearest monitored town ({nearest.name}, {distance:.0f} km away), "
            "not for this exact spot. Terrain values are estimates; this is not an official warning."
        ),
    }
