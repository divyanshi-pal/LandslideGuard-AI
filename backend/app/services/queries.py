"""Reusable database queries."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import RiskAssessment


def latest_assessments(db: Session) -> dict[int, RiskAssessment]:
    """Most recent assessment for every location, keyed by location id."""
    newest_ids = select(func.max(RiskAssessment.id)).group_by(RiskAssessment.location_id)
    rows = db.scalars(select(RiskAssessment).where(RiskAssessment.id.in_(newest_ids)))
    return {r.location_id: r for r in rows}
