from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import __version__
from ..config import Settings, get_settings
from ..deps import get_geocoder, get_ml_service
from ..schemas import REPORT_CATEGORIES
from ..services.geo import INDIA_ENVELOPE, INDIA_STATES_AND_UTS, NE_MONITORING_BOUNDS, boundary_mode
from ..services.geocoding import ReverseGeocoder
from ..services.ml_model import MLModelService
from ..services.risk_engine import DISCLAIMER

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/meta")
def meta(
    settings: Settings = Depends(get_settings),
    ml: MLModelService = Depends(get_ml_service),
    geocoder: ReverseGeocoder = Depends(get_geocoder),
) -> dict:
    status = ml.status()
    card = status["card"] or {}
    return {
        "app_name": settings.app_name,
        "version": __version__,
        "weather_provider": settings.weather_provider,
        "seed_demo_data": settings.seed_demo_data,
        "disclaimer": DISCLAIMER,
        # Landslide risk monitoring covers Northeast India only.
        "region_bounds": NE_MONITORING_BOUNDS,
        "max_upload_mb": settings.max_upload_mb,
        # Citizen incident reports are accepted from anywhere in India.
        "reporting": {
            "coverage": "India",
            "envelope": INDIA_ENVELOPE,
            "boundary_check": boundary_mode(settings.india_boundary_geojson),
            "states": list(INDIA_STATES_AND_UTS),
            "categories": list(REPORT_CATEGORIES),
            "max_photo_mb": settings.max_upload_mb,
            "video_enabled": settings.video_uploads_enabled,
            "max_video_mb": settings.max_video_mb,
            "public_shows_unverified": settings.public_show_unverified,
            "geocoding": geocoder.describe(),
        },
        "model": {
            "available": status["available"],
            "message": status["message"],
            "model_name": card.get("model_name"),
            "is_synthetic": card.get("is_synthetic"),
            "trained_at": card.get("trained_at"),
        },
    }
