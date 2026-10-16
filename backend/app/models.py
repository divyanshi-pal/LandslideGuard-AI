"""ORM models."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Location(Base):
    """A monitored site (district HQ town) with static terrain attributes."""

    __tablename__ = "locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    district: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(60), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    slope_deg: Mapped[float] = mapped_column(Float)
    soil_type: Mapped[str] = mapped_column(String(20))
    vegetation_ndvi: Mapped[float] = mapped_column(Float)
    slope_modified: Mapped[bool] = mapped_column(Boolean, default=False)
    # Where the static attributes came from, e.g. "demo-estimate" or "dem-derived".
    attributes_source: Mapped[str] = mapped_column(String(60), default="demo-estimate")

    assessments: Mapped[list[RiskAssessment]] = relationship(
        back_populates="location", cascade="all, delete-orphan", order_by="RiskAssessment.created_at"
    )


class RiskAssessment(Base):
    """One computed risk evaluation for a location at a point in time."""

    __tablename__ = "risk_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    rainfall_24h_mm: Mapped[float] = mapped_column(Float)
    rainfall_72h_mm: Mapped[float] = mapped_column(Float)
    soil_moisture: Mapped[float] = mapped_column(Float)
    score: Mapped[float] = mapped_column(Float)
    level: Mapped[str] = mapped_column(String(20), index=True)
    susceptibility: Mapped[float] = mapped_column(Float)
    trigger: Mapped[float] = mapped_column(Float)
    ml_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    # "demo" (simulated) or "open-meteo" (live model data)
    data_source: Mapped[str] = mapped_column(String(30))
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    location: Mapped[Location] = relationship(back_populates="assessments")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20))  # Low | Moderate | High | Very High
    state: Mapped[str | None] = mapped_column(String(60), nullable=True)
    location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(20))  # "system" | "admin"
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # active | resolved
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set only when an admin relays a warning issued by an official body (e.g. a DDMA or IMD).
    official_source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    official_reference: Mapped[str | None] = mapped_column(String(500), nullable=True)

    location: Mapped[Location | None] = relationship()


class CitizenReport(Base):
    __tablename__ = "citizen_reports"
    __table_args__ = (
        # Idempotency key sent by the client; NULLs are allowed many times.
        Index("ix_citizen_reports_client_submission_id", "client_submission_id", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    # When the reporter says the incident happened / was observed (created_at = when we received it).
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(40))  # incident type
    description: Mapped[str] = mapped_column(Text)
    observed_severity: Mapped[str] = mapped_column(String(20))  # minor | moderate | severe

    # Location. location_source is reported by the client: "gps" (browser Geolocation API),
    # "map" (picked on the map), "manual" (typed coordinates) or "unknown" (older records).
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location_source: Mapped[str] = mapped_column(String(20), default="unknown", server_default="unknown")
    location_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)  # GPS only
    location_check: Mapped[str | None] = mapped_column(String(30), nullable=True)  # india_envelope | india_boundary
    location_text: Mapped[str | None] = mapped_column(String(200), nullable=True)  # landmark
    state: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    district: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # user | geocoder | admin

    reporter_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reporter_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Media are stored privately under UPLOAD_DIR with random names.
    photo_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    photo_content_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # of the original upload
    photo_exif_datetime: Mapped[str | None] = mapped_column(String(32), nullable=True)  # camera time, read before stripping
    video_filename: Mapped[str | None] = mapped_column(String(80), nullable=True)
    video_content_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    video_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    video_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    client_submission_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    possible_duplicate_of: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(60), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    events: Mapped[list[ReportEvent]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="ReportEvent.id"
    )


class ReportEvent(Base):
    """Audit trail of a citizen report: submission, status changes and admin edits."""

    __tablename__ = "report_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("citizen_reports.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # submitted | status_changed | location_corrected | notes_updated
    kind: Mapped[str] = mapped_column(String(30))
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actor: Mapped[str | None] = mapped_column(String(60), nullable=True)  # admin username; None = reporter/system
    detail: Mapped[str | None] = mapped_column(String(300), nullable=True)

    report: Mapped[CitizenReport] = relationship(back_populates="events")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
