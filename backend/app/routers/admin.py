from __future__ import annotations

import mimetypes
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..database import get_db
from ..deps import get_ml_service, get_weather_provider
from ..models import AdminUser, Alert, CitizenReport, Location, ReportEvent
from ..schemas import (
    AlertCreate,
    AlertOut,
    AlertUpdate,
    LoginRequest,
    RefreshResult,
    ReportAdmin,
    ReportCategory,
    ReportDetailAdmin,
    ReportEventOut,
    ReportSeverity,
    ReportStatus,
    ReportUpdate,
    TokenOut,
)
from ..security import authenticate, create_token, require_admin
from ..services.assessment import refresh_assessments
from ..services.geo import normalize_state
from ..services.media_access import signed_media_url, verify_media_signature
from ..services.ml_model import MLModelService
from ..services.uploads import delete_media, media_path
from ..services.weather import WeatherProvider
from .reports import apply_report_filters, to_public

router = APIRouter(prefix="/api/admin", tags=["admin"])


def to_admin(report: CitizenReport) -> ReportAdmin:
    return to_public(
        report,
        ReportAdmin,
        photo_url=signed_media_url(report.id, "photo") if report.photo_filename else None,
        has_video=bool(report.video_filename),
        video_url=signed_media_url(report.id, "video") if report.video_filename else None,
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    user = authenticate(db, body.username, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token, expires = create_token(user.username)
    return TokenOut(access_token=token, expires_at=expires, username=user.username)


@router.get("/me")
def me(user: AdminUser = Depends(require_admin)) -> dict:
    return {"username": user.username}


# ---------- Reports ----------
@router.get("/reports", response_model=list[ReportAdmin])
def list_reports(
    status_filter: ReportStatus | None = Query(None, alias="status"),
    state: str | None = Query(None, description="State/UT name, or 'unspecified'"),
    district: str | None = None,
    category: ReportCategory | None = None,
    severity: ReportSeverity | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> list[ReportAdmin]:
    stmt = apply_report_filters(
        select(CitizenReport), state=state, district=district, category=category, severity=severity,
        statuses=[status_filter] if status_filter else None, date_from=date_from, date_to=date_to,
    )
    return [to_admin(r) for r in db.scalars(stmt.limit(limit))]


@router.patch("/reports/{report_id}", response_model=ReportAdmin)
def update_report(
    report_id: int,
    body: ReportUpdate,
    db: Session = Depends(get_db),
    user: AdminUser = Depends(require_admin),
) -> ReportAdmin:
    report = db.get(CitizenReport, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    changes = body.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc)
    if "state" in changes and changes["state"]:
        canonical = normalize_state(changes["state"])
        if canonical is None:
            raise HTTPException(422, f"Unknown state or union territory: {changes['state']!r}")
        changes["state"] = canonical
    for key in ("state", "district", "address"):
        if key in changes and isinstance(changes[key], str):
            changes[key] = changes[key].strip() or None
    if "address" in changes:
        report.address_source = "admin" if changes["address"] else None

    # Record what actually changes in the report's history.
    events: list[ReportEvent] = []
    if changes.get("status") and changes["status"] != report.status:
        report.reviewed_by, report.reviewed_at = user.username, now
        events.append(ReportEvent(kind="status_changed", from_status=report.status, to_status=changes["status"]))
    corrected = [k for k in ("state", "district", "address") if k in changes and changes[k] != getattr(report, k)]
    if corrected:
        events.append(ReportEvent(kind="location_corrected", detail="Corrected: " + ", ".join(corrected)))
    if "admin_notes" in changes and (changes["admin_notes"] or None) != (report.admin_notes or None):
        events.append(ReportEvent(kind="notes_updated"))

    for key, value in changes.items():
        setattr(report, key, value)
    report.updated_at = now
    for event in events:
        event.actor, event.created_at = user.username, now
        report.events.append(event)
    db.commit()
    db.refresh(report)
    return to_admin(report)


@router.get("/reports/{report_id}", response_model=ReportDetailAdmin)
def get_report_admin(
    report_id: int,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> ReportDetailAdmin:
    report = db.get(CitizenReport, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    return ReportDetailAdmin(
        report=to_admin(report),
        history=[ReportEventOut.model_validate(e) for e in report.events],
    )


@router.get("/media/{report_id}/{kind}", include_in_schema=False)
def admin_media(
    report_id: int,
    kind: Literal["photo", "video"],
    exp: int,
    sig: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Photo or video of any report, through a signed, expiring link issued in the admin listing."""
    if not verify_media_signature(report_id, kind, exp, sig):
        raise HTTPException(403, "Media link is invalid or has expired")
    report = db.get(CitizenReport, report_id)
    name = getattr(report, f"{kind}_filename", None) if report else None
    path = media_path(settings.upload_dir, name)
    if path is None:
        raise HTTPException(404, "Media not found")
    content_type = getattr(report, f"{kind}_content_type") or mimetypes.guess_type(path.name)[0]
    return FileResponse(
        path,
        media_type=content_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: AdminUser = Depends(require_admin),
) -> Response:
    report = db.get(CitizenReport, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    media = (report.photo_filename, report.video_filename)
    db.delete(report)
    db.commit()
    for name in media:
        delete_media(settings.upload_dir, name)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Alerts ----------
@router.post("/alerts", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    body: AlertCreate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> Alert:
    data = body.model_dump()
    for key in ("official_source", "official_reference"):
        data[key] = (data[key] or "").strip() or None
    if data["official_reference"] and not data["official_source"]:
        raise HTTPException(422, "official_source is required when an official reference is given")
    if body.location_id is not None:
        loc = db.get(Location, body.location_id)
        if loc is None:
            raise HTTPException(422, "Unknown location_id")
        data["state"] = data["state"] or loc.state
        data["latitude"] = data["latitude"] if data["latitude"] is not None else loc.latitude
        data["longitude"] = data["longitude"] if data["longitude"] is not None else loc.longitude
    alert = Alert(**data, source="admin", is_demo=False, status="active")
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def update_alert(
    alert_id: int,
    body: AlertUpdate,
    db: Session = Depends(get_db),
    _: AdminUser = Depends(require_admin),
) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(404, "Alert not found")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in changes.items():
        setattr(alert, key, value)
    if changes.get("status") == "resolved":
        alert.resolved_at = datetime.now(timezone.utc)
    elif changes.get("status") == "active":
        alert.resolved_at = None
    db.commit()
    db.refresh(alert)
    return alert


# ---------- Assessments ----------
@router.post("/assessments/refresh", response_model=RefreshResult)
def refresh(
    db: Session = Depends(get_db),
    provider: WeatherProvider = Depends(get_weather_provider),
    ml: MLModelService = Depends(get_ml_service),
    _: AdminUser = Depends(require_admin),
) -> RefreshResult:
    outcome = refresh_assessments(db, provider, ml)
    return RefreshResult(**outcome.__dict__)
