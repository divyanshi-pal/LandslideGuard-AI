"""Bootstrap data: admin account, sample locations, demo reports, first assessment."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import BACKEND_DIR, Settings
from .models import AdminUser, CitizenReport, Location, ReportEvent, RiskAssessment
from .security import hash_password, verify_password
from .services.assessment import refresh_assessments
from .services.ml_model import MLModelService
from .services.weather import WeatherProvider

logger = logging.getLogger("landslideguard.seed")

LOCATIONS_FILE = BACKEND_DIR / "data" / "locations_ne_india.json"

# Clearly labelled sample reports for a fresh install (never added to a database that has reports).
DEMO_REPORTS = [
    {
        "category": "ground_crack", "observed_severity": "moderate", "status": "verified",
        "latitude": 23.735, "longitude": 92.715, "location_text": "Near Aizawl (sample)",
        "state": "Mizoram", "district": "Aizawl",
        "description": "[DEMO] Sample report: new cracks seen along a retaining wall above the road after overnight rain.",
    },
    {
        "category": "road_blocked", "observed_severity": "severe", "status": "pending",
        "latitude": 25.18, "longitude": 93.03, "location_text": "Near Haflong (sample)",
        "state": "Assam", "district": "Dima Hasao",
        "description": "[DEMO] Sample report: debris partially blocking the road; vehicles passing one at a time.",
    },
    {
        "category": "water_seepage", "observed_severity": "minor", "status": "pending",
        "latitude": 27.325, "longitude": 88.615, "location_text": "Near Gangtok (sample)",
        "state": "Sikkim", "district": "Gangtok",
        "description": "[DEMO] Sample report: muddy water seeping out of the hillside behind houses.",
    },
    {
        "category": "rockfall", "observed_severity": "minor", "status": "resolved",
        "latitude": 25.68, "longitude": 94.1, "location_text": "Near Kohima (sample)",
        "state": "Nagaland", "district": "Kohima",
        "description": "[DEMO] Sample report: small rocks falling onto the highway shoulder.",
    },
    {
        "category": "slope_movement", "observed_severity": "moderate", "status": "verified",
        "latitude": 31.104, "longitude": 77.173, "location_text": "Near Shimla (sample)",
        "state": "Himachal Pradesh", "district": "Shimla",
        "description": "[DEMO] Sample report: trees and electric poles on the slope below the road are tilting.",
    },
    {
        "category": "flood", "observed_severity": "moderate", "status": "pending",
        "latitude": 10.089, "longitude": 77.06, "location_text": "Near Munnar (sample)",
        "state": "Kerala", "district": "Idukki",
        "description": "[DEMO] Sample report: stream overflowing onto the road after heavy rain.",
    },
]


def seed_admin(db: Session, settings: Settings) -> None:
    user = db.scalar(select(AdminUser).where(AdminUser.username == settings.admin_username))
    if user is None:
        db.add(AdminUser(username=settings.admin_username, password_hash=hash_password(settings.admin_password)))
    elif not verify_password(settings.admin_password, user.password_hash):
        # The environment is the source of truth for the bootstrap admin password.
        user.password_hash = hash_password(settings.admin_password)
    db.commit()


def load_locations(path: Path = LOCATIONS_FILE) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    source = data["_meta"]["attributes_source"]
    return [{**loc, "attributes_source": source} for loc in data["locations"]]


def seed_locations(db: Session) -> int:
    if db.scalar(select(func.count(Location.id))):
        return 0
    rows = load_locations()
    db.add_all(Location(**row) for row in rows)
    db.commit()
    return len(rows)


def seed_demo_reports(db: Session) -> int:
    if db.scalar(select(func.count(CitizenReport.id))):
        return 0
    now = datetime.now(timezone.utc)
    for r in DEMO_REPORTS:
        report = CitizenReport(**r, is_demo=True, location_source="map", location_check="india_envelope", observed_at=now)
        report.events.append(ReportEvent(kind="submitted", to_status="pending", created_at=now))
        if report.status != "pending":
            report.events.append(ReportEvent(kind="status_changed", from_status="pending", to_status=report.status,
                                             created_at=now, detail="Sample data"))
        db.add(report)
    db.commit()
    return len(DEMO_REPORTS)


def seed_all(db: Session, settings: Settings, provider: WeatherProvider, ml_service: MLModelService) -> None:
    seed_admin(db, settings)
    if not settings.seed_demo_data:
        return
    n_loc = seed_locations(db)
    n_rep = seed_demo_reports(db)
    if n_loc or n_rep:
        logger.info("Seeded %d locations and %d demo reports", n_loc, n_rep)
    if not db.scalar(select(func.count(RiskAssessment.id))):
        outcome = refresh_assessments(db, provider, ml_service)
        logger.info("Initial assessment: %d locations (%s)", outcome.assessed, outcome.data_source)
