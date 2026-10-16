from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Location, RiskAssessment
from ..schemas import AssessmentOut, LocationDetail, LocationOut
from ..services.queries import latest_assessments

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def list_locations(state: str | None = None, db: Session = Depends(get_db)) -> list[LocationOut]:
    stmt = select(Location).order_by(Location.state, Location.name)
    if state:
        stmt = stmt.where(Location.state == state)
    latest = latest_assessments(db)
    out = []
    for loc in db.scalars(stmt):
        item = LocationOut.model_validate(loc)
        a = latest.get(loc.id)
        item.latest = AssessmentOut.model_validate(a) if a else None
        out.append(item)
    return out


@router.get("/{location_id}", response_model=LocationDetail)
def get_location(
    location_id: int,
    history: int = Query(30, ge=1, le=500, description="Number of past assessments to include"),
    db: Session = Depends(get_db),
) -> LocationDetail:
    loc = db.get(Location, location_id)
    if loc is None:
        raise HTTPException(404, "Location not found")
    rows = list(
        db.scalars(
            select(RiskAssessment)
            .where(RiskAssessment.location_id == location_id)
            .order_by(RiskAssessment.id.desc())
            .limit(history)
        )
    )
    detail = LocationDetail.model_validate(loc)
    detail.history = [AssessmentOut.model_validate(r) for r in reversed(rows)]
    detail.latest = detail.history[-1] if detail.history else None
    return detail
