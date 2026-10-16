from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool

from ..config import Settings, get_settings
from ..deps import get_geocoder
from ..services.geo import CoordinateError, check_india_coordinates
from ..services.geocoding import ReverseGeocoder

router = APIRouter(prefix="/api/geocode", tags=["geocode"])


@router.get("/reverse")
async def reverse(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    geocoder: ReverseGeocoder = Depends(get_geocoder),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Suggest state/district/address for a point in India. status: ok | not_found | error | disabled."""
    try:
        check_india_coordinates(lat, lon, settings.india_boundary_geojson)
    except CoordinateError as exc:
        raise HTTPException(422, str(exc)) from exc
    return await run_in_threadpool(geocoder.reverse, lat, lon)


@router.get("/search")
async def search(
    q: str = Query(min_length=2, max_length=120, description="Place name, e.g. 'Joshimath' or 'Munnar, Kerala'"),
    geocoder: ReverseGeocoder = Depends(get_geocoder),
) -> dict:
    """Find places in India by name. status: ok | not_found | error | disabled."""
    return await run_in_threadpool(geocoder.search, q)
