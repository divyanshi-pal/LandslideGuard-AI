"""Geographic scope, coordinate validation and Indian state/UT names.

Coverage for citizen reports is **India**. Two levels of checking:

1. Always: coordinates must be finite and inside INDIA_ENVELOPE, a bounding box around
   India's extreme points (approx. 6.5-37.1 N, 68.1-97.4 E, with a small margin).
   A bounding box is coarse: it also contains parts of neighbouring countries
   (e.g. Nepal, Bangladesh, Sri Lanka). Points there pass this check.
2. Optional: if INDIA_BOUNDARY_GEOJSON points to a boundary file (e.g. from the Survey of
   India), points must also fall inside that polygon. No boundary data ships with the
   project - we do not hand-draw national boundaries.

Landslide *risk monitoring* stays limited to the Northeast monitoring region
(NE_MONITORING_BOUNDS); that is separate from where reports may come from.
"""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path

INDIA_ENVELOPE = {"min_lat": 6.0, "max_lat": 37.6, "min_lon": 68.0, "max_lon": 97.6}
NE_MONITORING_BOUNDS = {"min_lat": 21.0, "max_lat": 30.0, "min_lon": 87.5, "max_lon": 98.0}

INDIA_STATES_AND_UTS: tuple[str, ...] = (
    # States
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    # Union territories
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
)

_ALIASES = {
    "nct of delhi": "Delhi",
    "national capital territory of delhi": "Delhi",
    "new delhi": "Delhi",
    "orissa": "Odisha",
    "uttaranchal": "Uttarakhand",
    "pondicherry": "Puducherry",
    "andaman and nicobar": "Andaman and Nicobar Islands",
    "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
    "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
}
_CANONICAL = {s.lower(): s for s in INDIA_STATES_AND_UTS}


class CoordinateError(ValueError):
    """Coordinates are invalid or outside the reporting coverage."""


def _key(name: str) -> str:
    return re.sub(r"\s+", " ", name.replace("&", " and ")).strip().lower()


def normalize_state(name: str | None) -> str | None:
    """Return the canonical state/UT name, or None if it is not recognised."""
    if not name or not name.strip():
        return None
    key = _key(name)
    return _CANONICAL.get(key) or _ALIASES.get(key)


def in_bounds(lat: float, lon: float, b: dict) -> bool:
    return b["min_lat"] <= lat <= b["max_lat"] and b["min_lon"] <= lon <= b["max_lon"]


# ---------------------------------------------------------------- boundary file
Polygon = list[list[tuple[float, float]]]  # [outer ring, *holes]; points are (lon, lat)


def _polygons_from_geojson(obj: dict) -> list[Polygon]:
    kind = obj.get("type")
    if kind == "FeatureCollection":
        return [p for f in obj.get("features", []) for p in _polygons_from_geojson(f)]
    if kind == "Feature":
        return _polygons_from_geojson(obj.get("geometry") or {})
    if kind == "GeometryCollection":
        return [p for g in obj.get("geometries", []) for p in _polygons_from_geojson(g)]
    if kind == "Polygon":
        return [[[(float(x), float(y)) for x, y, *_ in ring] for ring in obj["coordinates"]]]
    if kind == "MultiPolygon":
        return [[[(float(x), float(y)) for x, y, *_ in ring] for ring in poly] for poly in obj["coordinates"]]
    return []


def _in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def point_in_polygons(lat: float, lon: float, polygons: list[Polygon]) -> bool:
    for outer, *holes in polygons:
        if _in_ring(lon, lat, outer) and not any(_in_ring(lon, lat, h) for h in holes):
            return True
    return False


@lru_cache(maxsize=4)
def load_boundary(path: str) -> list[Polygon]:
    polygons = _polygons_from_geojson(json.loads(Path(path).read_text(encoding="utf-8")))
    if not polygons:
        raise ValueError(f"No Polygon/MultiPolygon geometry found in {path}")
    return polygons


def boundary_mode(boundary_path: str) -> str:
    return "official-boundary-file" if boundary_path else "bounding-envelope"


# ---------------------------------------------------------------- validation
def check_india_coordinates(lat: float, lon: float, boundary_path: str = "") -> str:
    """Validate a report location. Returns the check that was applied, or raises CoordinateError."""
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise CoordinateError("Latitude and longitude must be valid numbers")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise CoordinateError("Latitude must be between -90 and 90 and longitude between -180 and 180")
    if not in_bounds(lat, lon, INDIA_ENVELOPE):
        raise CoordinateError("Location is outside India. Reports are accepted only for locations in India.")
    if boundary_path:
        if not point_in_polygons(lat, lon, load_boundary(boundary_path)):
            raise CoordinateError("Location is outside India's boundary. Reports are accepted only for locations in India.")
        return "india_boundary"
    return "india_envelope"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
