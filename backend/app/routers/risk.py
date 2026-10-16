from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..database import get_db
from ..deps import get_ml_service
from ..schemas import RiskInput, RiskPrediction
from ..services.geo import CoordinateError, check_india_coordinates
from ..services.ml_model import MLModelService
from ..services.risk_context import risk_context
from ..services.risk_engine import DISCLAIMER, compute_heuristic, methodology

router = APIRouter(prefix="/api/risk", tags=["risk"])


@router.get("/context")
def location_risk_context(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """What LandslideGuard can say about risk at a point: a nearby monitored estimate, or 'unavailable'."""
    try:
        check_india_coordinates(lat, lon, settings.india_boundary_geojson)
    except CoordinateError as exc:
        raise HTTPException(422, str(exc)) from exc
    return risk_context(db, lat, lon)


@router.post("/predict", response_model=RiskPrediction)
def predict(body: RiskInput, ml: MLModelService = Depends(get_ml_service)) -> RiskPrediction:
    inputs = body.to_inputs()
    return RiskPrediction(
        inputs=inputs.as_feature_dict(),
        heuristic=compute_heuristic(inputs),
        ml=ml.predict(inputs),
        disclaimer=DISCLAIMER,
    )


@router.get("/methodology")
def get_methodology() -> dict:
    return methodology()


@router.get("/model")
def model_card(ml: MLModelService = Depends(get_ml_service)) -> dict:
    return ml.status()
