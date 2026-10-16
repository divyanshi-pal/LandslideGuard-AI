"""Unit tests for automatic system-alert creation and resolution."""

from sqlalchemy import select

from app.database import SessionLocal, init_db
from app.models import Alert, Location, RiskAssessment
from app.services.assessment import RefreshOutcome, sync_system_alerts


def _assessment(db, loc: Location, level: str, score: float, source: str = "demo") -> RiskAssessment:
    a = RiskAssessment(
        location=loc, rainfall_24h_mm=120, rainfall_72h_mm=260, soil_moisture=0.42,
        score=score, level=level, susceptibility=0.8, trigger=0.8, data_source=source, details={},
    )
    db.add(a)
    return a


def test_alert_created_updated_and_resolved():
    init_db()
    with SessionLocal() as db:
        loc = Location(name="Alert Test Town", district="Test", state="Mizoram", latitude=23.5,
                       longitude=92.7, slope_deg=35, soil_type="clay", vegetation_ndvi=0.5,
                       slope_modified=True)
        db.add(loc)
        db.flush()

        def active():
            return list(db.scalars(select(Alert).where(
                Alert.location_id == loc.id, Alert.source == "system", Alert.status == "active")))

        out = RefreshOutcome()
        sync_system_alerts(db, [_assessment(db, loc, "High", 62)], out)
        db.flush()
        assert out.alerts_created == 1
        [alert] = active()
        assert alert.is_demo and alert.title.startswith("[DEMO]")

        out = RefreshOutcome()
        sync_system_alerts(db, [_assessment(db, loc, "Very High", 81, source="open-meteo")], out)
        db.flush()
        assert out.alerts_updated == 1 and out.alerts_created == 0
        [alert] = active()
        assert alert.level == "Very High" and not alert.is_demo and not alert.title.startswith("[DEMO]")

        out = RefreshOutcome()
        sync_system_alerts(db, [_assessment(db, loc, "Moderate", 30)], out)
        db.flush()
        assert out.alerts_resolved == 1
        assert active() == []
        db.rollback()
