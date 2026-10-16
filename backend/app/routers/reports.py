from __future__ import annotations

import mimetypes
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..database import get_db
from ..deps import get_report_limiter
from ..models import CitizenReport, ReportEvent
from ..schemas import (
    AddressSource,
    LocationSource,
    ReportCategory,
    ReportCreated,
    ReportDetailPublic,
    ReportEventOut,
    ReportPublic,
    ReportSeverity,
    ReportStatus,
)
from ..services.geo import CoordinateError, check_india_coordinates, normalize_state
from ..services.media_access import PUBLIC_MEDIA_STATUSES, public_photo_url
from ..services.report_guard import RateLimiter, find_resubmission, find_same_photo
from ..services.uploads import MediaError, delete_media, media_path, save_photo, save_video

router = APIRouter(prefix="/api/reports", tags=["reports"])

MAX_FUTURE_SKEW = timedelta(minutes=10)
MAX_REPORT_AGE = timedelta(days=365)


def _clean(text: str | None) -> str | None:
    text = (text or "").strip()
    return text or None


def public_statuses(settings: Settings) -> tuple[str, ...]:
    return ("verified", "resolved", "pending") if settings.public_show_unverified else ("verified", "resolved")


def to_public(report: CitizenReport, model=ReportPublic, **extra):
    return model.model_validate(report).model_copy(update={
        "has_photo": bool(report.photo_filename),
        "photo_url": public_photo_url(report),
        **extra,
    })


def apply_report_filters(stmt, *, state, district, category, severity, statuses, date_from, date_to):
    if state:
        stmt = stmt.where(CitizenReport.state == state) if state != "unspecified" else stmt.where(CitizenReport.state.is_(None))
    if district:
        stmt = stmt.where(func.lower(CitizenReport.district) == district.strip().lower())
    if category:
        stmt = stmt.where(CitizenReport.category == category)
    if severity:
        stmt = stmt.where(CitizenReport.observed_severity == severity)
    if statuses:
        stmt = stmt.where(CitizenReport.status.in_(statuses))
    when = func.coalesce(CitizenReport.observed_at, CitizenReport.created_at)
    if date_from:
        stmt = stmt.where(when >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        stmt = stmt.where(when < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc))
    return stmt.order_by(when.desc(), CitizenReport.id.desc())


def _validate_state(state: str | None) -> str | None:
    if state is None:
        return None
    canonical = normalize_state(state)
    if canonical is None:
        raise HTTPException(422, f"Unknown state or union territory: {state!r}")
    return canonical


def _validate_observed_at(observed_at: datetime | None) -> datetime:
    now = datetime.now(timezone.utc)
    if observed_at is None:
        return now
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)  # clients should send UTC (ISO 8601 with Z)
    # Store in UTC: the database layer drops offsets, so +05:30 must be converted first.
    observed_at = observed_at.astimezone(timezone.utc)
    if observed_at > now + MAX_FUTURE_SKEW:
        raise HTTPException(422, "Incident time cannot be in the future")
    if observed_at < now - MAX_REPORT_AGE:
        raise HTTPException(422, "Incident time is more than a year ago")
    return observed_at


@router.post("", response_model=ReportCreated, status_code=status.HTTP_201_CREATED)
async def create_report(
    request: Request,
    response: Response,
    category: Annotated[ReportCategory, Form(description="Incident type")],
    description: Annotated[str, Form(min_length=10, max_length=2000)],
    latitude: Annotated[float, Form(ge=-90, le=90)],
    longitude: Annotated[float, Form(ge=-180, le=180)],
    location_source: Annotated[LocationSource, Form(description="gps | map | manual")],
    location_accuracy_m: Annotated[float | None, Form(ge=0, le=100_000)] = None,
    observed_at: Annotated[datetime | None, Form(description="When it happened, ISO 8601 (UTC)")] = None,
    observed_severity: Annotated[ReportSeverity, Form()] = "moderate",
    state: Annotated[str | None, Form(max_length=60)] = None,
    district: Annotated[str | None, Form(max_length=120)] = None,
    address: Annotated[str | None, Form(max_length=300)] = None,
    address_source: Annotated[AddressSource | None, Form()] = None,
    location_text: Annotated[str | None, Form(max_length=200)] = None,
    reporter_name: Annotated[str | None, Form(max_length=120)] = None,
    reporter_contact: Annotated[str | None, Form(max_length=120)] = None,
    client_submission_id: Annotated[str | None, Form(pattern=r"^[A-Za-z0-9_-]{8,64}$")] = None,
    photo: Annotated[UploadFile | None, File()] = None,
    video: Annotated[UploadFile | None, File()] = None,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(get_report_limiter),
):
    # 1. Validate everything that does not need storage.
    try:
        location_check = check_india_coordinates(latitude, longitude, settings.india_boundary_geojson)
    except CoordinateError as exc:
        raise HTTPException(422, str(exc)) from exc
    description = description.strip()
    canonical_state = _validate_state(_clean(state))
    observed = _validate_observed_at(observed_at)
    has_video_upload = video is not None and bool(video.filename)
    if has_video_upload and not settings.video_uploads_enabled:
        raise HTTPException(422, "Video uploads are disabled on this server")

    # 2. Rate limit before doing any expensive work.
    client_key = request.client.host if request.client else "unknown"
    if not limiter.allow(client_key):
        raise HTTPException(429, "Too many reports from this connection. Please try again later.")

    # 3. Validate and store media (rejects bad files even on a resubmission).
    saved: list[str] = []
    try:
        photo_info = video_info = None
        if photo is not None and photo.filename:
            max_bytes = int(settings.max_upload_mb * 1024 * 1024)
            photo_info = save_photo(await photo.read(max_bytes + 1), settings.upload_dir, max_bytes)
            saved.append(photo_info.filename)
        if has_video_upload:
            max_bytes = int(settings.max_video_mb * 1024 * 1024)
            video_info = save_video(await video.read(max_bytes + 1), settings.upload_dir, max_bytes)
            saved.append(video_info.filename)
    except MediaError as exc:
        for name in saved:
            delete_media(settings.upload_dir, name)
        raise HTTPException(422, str(exc)) from exc

    # 4. A repeat of an earlier submission (double click, retry, refresh) returns the original.
    existing = find_resubmission(
        db, client_submission_id=client_submission_id, category=category, description=description,
        latitude=latitude, longitude=longitude,
    )
    if existing is not None:
        for name in saved:
            delete_media(settings.upload_dir, name)
        response.status_code = status.HTTP_200_OK
        return to_public(existing, ReportCreated, duplicate=True, has_video=bool(existing.video_filename))

    clean_address = _clean(address)
    report = CitizenReport(
        category=category,
        description=description,
        observed_severity=observed_severity,
        observed_at=observed,
        latitude=latitude,
        longitude=longitude,
        location_source=location_source,
        # Accuracy is only meaningful for coordinates from the device's location service.
        location_accuracy_m=location_accuracy_m if location_source == "gps" else None,
        location_check=location_check,
        state=canonical_state,
        district=_clean(district),
        address=clean_address,
        address_source=(address_source or "user") if clean_address else None,
        location_text=_clean(location_text),
        reporter_name=_clean(reporter_name),
        reporter_contact=_clean(reporter_contact),
        client_submission_id=client_submission_id,
        status="pending",
    )
    if photo_info:
        report.photo_filename = photo_info.filename
        report.photo_content_type = photo_info.content_type
        report.photo_size_bytes = photo_info.size_bytes
        report.photo_width, report.photo_height = photo_info.width, photo_info.height
        report.photo_sha256 = photo_info.sha256
        report.photo_exif_datetime = photo_info.exif_datetime
        report.possible_duplicate_of = find_same_photo(db, photo_info.sha256)
    if video_info:
        report.video_filename = video_info.filename
        report.video_content_type = video_info.content_type
        report.video_size_bytes = video_info.size_bytes
        report.video_sha256 = video_info.sha256

    db.add(report)
    try:
        db.flush()  # assigns the id; raises IntegrityError on a duplicate submission id
        db.add(ReportEvent(report_id=report.id, kind="submitted", to_status="pending"))
        db.commit()
    except IntegrityError:
        # A concurrent request with the same client_submission_id won the race.
        db.rollback()
        for name in saved:
            delete_media(settings.upload_dir, name)
        existing = db.scalar(select(CitizenReport).where(CitizenReport.client_submission_id == client_submission_id))
        if existing is None:
            raise
        response.status_code = status.HTTP_200_OK
        return to_public(existing, ReportCreated, duplicate=True, has_video=bool(existing.video_filename))
    except Exception:
        db.rollback()
        for name in saved:
            delete_media(settings.upload_dir, name)
        raise
    db.refresh(report)
    return to_public(report, ReportCreated, has_video=bool(report.video_filename))


@router.get("", response_model=list[ReportPublic])
def list_public_reports(
    state: str | None = Query(None, description="State/UT name, or 'unspecified'"),
    district: str | None = None,
    category: ReportCategory | None = None,
    severity: ReportSeverity | None = None,
    status_filter: ReportStatus | None = Query(None, alias="status"),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Reports visible to the public. Reporter identity, contact details and full address are never included."""
    allowed = public_statuses(settings)
    if status_filter and status_filter not in allowed:
        return []
    stmt = apply_report_filters(
        select(CitizenReport), state=state, district=district, category=category, severity=severity,
        statuses=[status_filter] if status_filter else list(allowed), date_from=date_from, date_to=date_to,
    )
    return [to_public(r) for r in db.scalars(stmt.limit(limit))]


PUBLIC_EVENT_KINDS = ("submitted", "status_changed")
STATUS_MESSAGES = {
    "pending": "This report has been received and is waiting for an administrator to review it.",
    "rejected": "This report was reviewed and not published.",
}


def public_history(report: CitizenReport) -> list[ReportEventOut]:
    """Submission and status changes only; admin usernames and internal notes are never public."""
    return [
        ReportEventOut.model_validate(e).model_copy(update={"actor": None, "detail": None})
        for e in report.events
        if e.kind in PUBLIC_EVENT_KINDS
    ]


@router.get("/{report_id}", response_model=ReportDetailPublic)
def get_report(report_id: int, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    """One report with its public timeline. Unpublished reports show only status and timeline,
    so a reporter can follow their report without exposing its content."""
    report = db.get(CitizenReport, report_id)
    if report is None:
        raise HTTPException(404, "Report not found")
    visible = report.status in public_statuses(settings)
    return ReportDetailPublic(
        id=report.id,
        status=report.status,
        visible=visible,
        created_at=report.created_at,
        report=to_public(report) if visible else None,
        history=public_history(report),
        message=None if visible else STATUS_MESSAGES.get(report.status, "This report is not public."),
    )


@router.get("/{report_id}/photo", include_in_schema=False)
def public_photo(report_id: int, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    """A report's photo, only once an administrator has verified or resolved the report."""
    report = db.get(CitizenReport, report_id)
    path = media_path(settings.upload_dir, report.photo_filename) if report else None
    if report is None or report.status not in PUBLIC_MEDIA_STATUSES or path is None:
        raise HTTPException(404, "Photo not available")
    return FileResponse(
        path,
        media_type=report.photo_content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"},
    )
