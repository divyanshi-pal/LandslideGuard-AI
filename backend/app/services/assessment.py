"""Compute risk for all monitored locations and maintain system alerts."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Alert, Location, RiskAssessment
from .ml_model import MLModelService
from .risk_engine import GUIDANCE, LEVEL_ORDER, RiskInputs, compute_heuristic
from .weather import SiteRef, WeatherProvider, fetch_weather

ALERT_LEVELS = {"High", "Very High"}
SOURCE_LABELS = {"demo": "SIMULATED demo rainfall", "open-meteo": "Open-Meteo model data"}


@dataclass
class RefreshOutcome:
    assessed: int = 0
    data_source: str = ""
    warnings: list[str] = field(default_factory=list)
    alerts_created: int = 0
    alerts_updated: int = 0
    alerts_resolved: int = 0


def inputs_for(location: Location, rain24: float, rain72: float, moisture: float) -> RiskInputs:
    return RiskInputs(
        rainfall_24h_mm=rain24,
        rainfall_72h_mm=rain72,
        soil_moisture=moisture,
        slope_deg=location.slope_deg,
        vegetation_ndvi=location.vegetation_ndvi,
        soil_type=location.soil_type,
        slope_modified=location.slope_modified,
    )


def _alert_text(loc: Location, a: RiskAssessment) -> tuple[str, str]:
    prefix = "[DEMO] " if a.data_source == "demo" else ""
    title = f"{prefix}{a.level} landslide risk - {loc.name}, {loc.state}"
    message = (
        f"Computed risk index {a.score:.0f}/100 ({a.level}) for {loc.name}, {loc.district} district. "
        f"Rainfall last 72 h: {a.rainfall_72h_mm:.0f} mm, last 24 h: {a.rainfall_24h_mm:.0f} mm "
        f"({SOURCE_LABELS.get(a.data_source, a.data_source)}). {GUIDANCE[a.level]}"
    )
    if a.data_source == "demo":
        message += " THIS IS A DEMONSTRATION ALERT BASED ON SIMULATED DATA - NOT A REAL WARNING."
    return title, message


def sync_system_alerts(db: Session, assessments: list[RiskAssessment], outcome: RefreshOutcome) -> None:
    active = {
        a.location_id: a
        for a in db.scalars(select(Alert).where(Alert.source == "system", Alert.status == "active"))
    }
    now = datetime.now(timezone.utc)
    for assessment in assessments:
        loc = assessment.location
        existing = active.get(loc.id)
        if assessment.level in ALERT_LEVELS:
            title, message = _alert_text(loc, assessment)
            is_demo = assessment.data_source == "demo"
            if existing is None:
                db.add(Alert(
                    title=title, message=message, level=assessment.level, state=loc.state,
                    location_id=loc.id, latitude=loc.latitude, longitude=loc.longitude,
                    source="system", is_demo=is_demo, status="active",
                ))
                outcome.alerts_created += 1
            elif (existing.level, existing.message) != (assessment.level, message):
                existing.title, existing.message, existing.level = title, message, assessment.level
                existing.is_demo = is_demo
                outcome.alerts_updated += 1
        elif existing is not None:
            existing.status = "resolved"
            existing.resolved_at = now
            outcome.alerts_resolved += 1


def refresh_assessments(
    db: Session, provider: WeatherProvider, ml_service: MLModelService
) -> RefreshOutcome:
    locations = list(db.scalars(select(Location).order_by(Location.id)))
    outcome = RefreshOutcome()
    if not locations:
        return outcome

    sites = [SiteRef(l.id, l.name, l.latitude, l.longitude) for l in locations]
    readings, warnings = fetch_weather(sites, provider)
    outcome.warnings = warnings

    created: list[RiskAssessment] = []
    for loc in locations:
        r = readings[loc.id]
        inputs = inputs_for(loc, r.rainfall_24h_mm, r.rainfall_72h_mm, r.soil_moisture)
        heuristic = compute_heuristic(inputs)
        ml = ml_service.predict(inputs)
        assessment = RiskAssessment(
            location=loc,
            rainfall_24h_mm=r.rainfall_24h_mm,
            rainfall_72h_mm=r.rainfall_72h_mm,
            soil_moisture=r.soil_moisture,
            score=heuristic["score"],
            level=heuristic["level"],
            susceptibility=heuristic["susceptibility"],
            trigger=heuristic["trigger"],
            ml_probability=ml.get("probability"),
            data_source=r.source,
            details={
                "weather_observed_at": r.observed_at.isoformat(),
                "weather_note": r.note,
                "factors": heuristic["factors"],
                "top_drivers": heuristic["top_drivers"],
                "guidance": heuristic["guidance"],
                "method": heuristic["method"],
                "ml_model": ml.get("model_name"),
                "ml_is_synthetic": ml.get("is_synthetic"),
            },
        )
        db.add(assessment)
        created.append(assessment)

    outcome.assessed = len(created)
    sources = {a.data_source for a in created}
    outcome.data_source = sources.pop() if len(sources) == 1 else "mixed"
    db.flush()
    sync_system_alerts(db, created, outcome)
    db.commit()
    return outcome


def level_rank(level: str) -> int:
    return LEVEL_ORDER.index(level)
