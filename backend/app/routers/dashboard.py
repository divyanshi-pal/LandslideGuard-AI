from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_ml_service
from ..models import Alert, CitizenReport, Location
from ..schemas import _as_utc
from ..services.ml_model import MLModelService
from ..services.queries import latest_assessments
from ..services.risk_engine import LEVEL_ORDER

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

HIGH_LEVELS = {"High", "Very High"}
PUBLIC_STATUSES = ("verified", "resolved")
TREND_DAYS = 30


@router.get("/summary")
def summary(db: Session = Depends(get_db), ml: MLModelService = Depends(get_ml_service)) -> dict:
    locations = {loc.id: loc for loc in db.scalars(select(Location))}
    latest = latest_assessments(db)

    level_counts = {lvl: 0 for lvl in LEVEL_ORDER}
    sources: Counter[str] = Counter()
    per_state: dict[str, list] = defaultdict(list)
    points = []
    for loc_id, a in latest.items():
        loc = locations[loc_id]
        level_counts[a.level] += 1
        sources[a.data_source] += 1
        per_state[loc.state].append(a)
        points.append({
            "location_id": loc.id, "name": loc.name, "district": loc.district, "state": loc.state,
            "score": a.score, "level": a.level, "rainfall_24h_mm": a.rainfall_24h_mm,
            "rainfall_72h_mm": a.rainfall_72h_mm, "soil_moisture": a.soil_moisture,
            "ml_probability": a.ml_probability, "data_source": a.data_source,
        })

    by_state = sorted(
        (
            {
                "state": state,
                "locations": len(items),
                "avg_score": round(sum(i.score for i in items) / len(items), 1),
                "max_score": max(i.score for i in items),
                "max_level": max((i.level for i in items), key=LEVEL_ORDER.index),
                "high_or_above": sum(i.level in HIGH_LEVELS for i in items),
            }
            for state, items in per_state.items()
        ),
        key=lambda s: s["avg_score"],
        reverse=True,
    )

    report_status = dict(db.execute(
        select(CitizenReport.status, func.count()).group_by(CitizenReport.status)
    ).all())
    report_category = dict(db.execute(
        select(CitizenReport.category, func.count()).group_by(CitizenReport.category)
    ).all())
    active_alerts = db.scalar(select(func.count()).select_from(Alert).where(Alert.status == "active"))
    last = max((a.created_at for a in latest.values()), default=None)
    model_status = ml.status()
    card = model_status["card"] or {}

    # ---- Citizen reports, all of India (aggregate counts only; no report content) ----
    public_types = dict(db.execute(
        select(CitizenReport.category, func.count())
        .where(CitizenReport.status.in_(PUBLIC_STATUSES))
        .group_by(CitizenReport.category)
    ).all())
    today = datetime.now(timezone.utc).date()
    first_day = today - timedelta(days=TREND_DAYS - 1)
    day = func.date(CitizenReport.created_at)
    trend_rows = db.execute(
        select(day, CitizenReport.status, func.count())
        .where(CitizenReport.created_at >= datetime.combine(first_day, datetime.min.time(), tzinfo=timezone.utc))
        .group_by(day, CitizenReport.status)
    ).all()
    received: Counter[str] = Counter()
    published: Counter[str] = Counter()
    for d, status, n in trend_rows:
        key = str(d)[:10]
        received[key] += n
        if status in PUBLIC_STATUSES:
            published[key] += n
    trend = [
        {"date": (first_day + timedelta(days=i)).isoformat(),
         "received": received[(first_day + timedelta(days=i)).isoformat()],
         "verified_now": published[(first_day + timedelta(days=i)).isoformat()]}
        for i in range(TREND_DAYS)
    ]
    states_reported = db.scalar(
        select(func.count(func.distinct(CitizenReport.state))).where(CitizenReport.state.is_not(None))
    ) or 0
    demo_reports = db.scalar(select(func.count()).select_from(CitizenReport).where(CitizenReport.is_demo.is_(True))) or 0

    return {
        "reports": {
            "total": sum(report_status.values()),
            "by_status": report_status,
            "verified": report_status.get("verified", 0),
            "resolved": report_status.get("resolved", 0),
            "pending": report_status.get("pending", 0),
            "rejected": report_status.get("rejected", 0),
            "demo": demo_reports,
            "states_reported": states_reported,
            "public_by_type": public_types,
            "trend_days": TREND_DAYS,
            "trend": trend,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "last_assessed_at": _as_utc(last).isoformat() if last else None,
        "data_sources": dict(sources),
        "is_demo": sources.get("demo", 0) > 0,
        "totals": {
            "locations": len(locations),
            "assessed": len(latest),
            "high_or_above": level_counts["High"] + level_counts["Very High"],
            "active_alerts": active_alerts or 0,
            "pending_reports": report_status.get("pending", 0),
            "verified_reports": report_status.get("verified", 0),
            "total_reports": sum(report_status.values()),
        },
        "level_counts": level_counts,
        "by_state": by_state,
        "top_locations": sorted(points, key=lambda p: p["score"], reverse=True)[:8],
        "points": points,
        "reports_by_status": report_status,
        "reports_by_category": report_category,
        "model": {
            "available": model_status["available"],
            "model_name": card.get("model_name"),
            "is_synthetic": card.get("is_synthetic"),
        },
    }
