"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from .services.features import FEATURE_SPECS, SOIL_TYPES
from .services.risk_engine import RiskInputs


def _as_utc(dt: datetime) -> datetime:
    # SQLite drops tzinfo; every timestamp we store is UTC.
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]
RiskLevel = Literal["Low", "Moderate", "High", "Very High"]
SoilType = Literal[SOIL_TYPES]  # type: ignore[valid-type]
REPORT_CATEGORIES = (
    "landslide", "debris_flow", "rockfall", "ground_crack", "slope_movement", "land_subsidence",
    "flood", "flash_flood", "water_seepage", "road_blocked", "other",
)
ReportCategory = Literal[REPORT_CATEGORIES]  # type: ignore[valid-type]
ReportSeverity = Literal["minor", "moderate", "severe"]
ReportStatus = Literal["pending", "verified", "rejected", "resolved"]
LocationSource = Literal["gps", "map", "manual"]
AddressSource = Literal["user", "geocoder"]


def _spec(name: str) -> dict:
    return {"ge": FEATURE_SPECS[name]["min"], "le": FEATURE_SPECS[name]["max"]}


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Risk ----------
class RiskInput(BaseModel):
    rainfall_24h_mm: float = Field(**_spec("rainfall_24h_mm"))
    rainfall_72h_mm: float = Field(**_spec("rainfall_72h_mm"))
    soil_moisture: float = Field(**_spec("soil_moisture"))
    slope_deg: float = Field(**_spec("slope_deg"))
    vegetation_ndvi: float = Field(**_spec("vegetation_ndvi"))
    soil_type: SoilType
    slope_modified: bool = False

    def to_inputs(self) -> RiskInputs:
        return RiskInputs(**self.model_dump())


class RiskPrediction(BaseModel):
    inputs: dict[str, Any]
    heuristic: dict[str, Any]
    ml: dict[str, Any]
    disclaimer: str


# ---------- Locations ----------
class AssessmentOut(ORM):
    id: int
    created_at: UTCDateTime
    rainfall_24h_mm: float
    rainfall_72h_mm: float
    soil_moisture: float
    score: float
    level: RiskLevel
    susceptibility: float
    trigger: float
    ml_probability: float | None
    data_source: str
    details: dict[str, Any]


class LocationOut(ORM):
    id: int
    name: str
    district: str
    state: str
    latitude: float
    longitude: float
    slope_deg: float
    soil_type: str
    vegetation_ndvi: float
    slope_modified: bool
    attributes_source: str
    latest: AssessmentOut | None = None


class LocationDetail(LocationOut):
    history: list[AssessmentOut] = []


# ---------- Alerts ----------
class AlertOut(ORM):
    id: int
    created_at: UTCDateTime
    title: str
    message: str
    level: RiskLevel
    state: str | None
    location_id: int | None
    latitude: float | None
    longitude: float | None
    source: str
    is_demo: bool
    status: str
    resolved_at: UTCDateTime | None
    official_source: str | None = None
    official_reference: str | None = None


def _http_url(value: str | None) -> str | None:
    if value and not value.startswith(("http://", "https://")):
        raise ValueError("must be an http(s) URL")
    return value


class AlertCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=3, max_length=2000)
    level: RiskLevel
    state: str | None = Field(default=None, max_length=60)
    location_id: int | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    # Fill these only when relaying a warning issued by an official body.
    official_source: str | None = Field(default=None, max_length=200)
    official_reference: Annotated[str | None, AfterValidator(_http_url)] = Field(default=None, max_length=500)


class AlertUpdate(BaseModel):
    status: Literal["active", "resolved"] | None = None
    title: str | None = Field(default=None, min_length=3, max_length=200)
    message: str | None = Field(default=None, min_length=3, max_length=2000)
    level: RiskLevel | None = None


# ---------- Reports ----------
class ReportPublic(ORM):
    """Citizen report as the public sees it: no reporter identity, contact or full address."""

    id: int
    created_at: UTCDateTime
    observed_at: UTCDateTime | None
    category: str
    description: str
    observed_severity: str
    latitude: float
    longitude: float
    location_source: str
    location_text: str | None
    state: str | None
    district: str | None
    status: str
    is_demo: bool
    has_photo: bool = False
    photo_url: str | None = None  # set only once the report is verified or resolved


class ReportCreated(ReportPublic):
    duplicate: bool = False  # True when this request repeated an earlier submission
    has_video: bool = False


class ReportAdmin(ReportPublic):
    updated_at: UTCDateTime
    reporter_name: str | None
    reporter_contact: str | None
    admin_notes: str | None
    address: str | None
    address_source: str | None
    location_accuracy_m: float | None
    location_check: str | None
    possible_duplicate_of: int | None
    reviewed_by: str | None
    reviewed_at: UTCDateTime | None
    photo_content_type: str | None
    photo_size_bytes: int | None
    photo_width: int | None
    photo_height: int | None
    photo_exif_datetime: str | None
    has_video: bool = False
    video_url: str | None = None
    video_content_type: str | None
    video_size_bytes: int | None


class ReportEventOut(ORM):
    id: int
    created_at: UTCDateTime
    kind: str
    from_status: str | None
    to_status: str | None
    actor: str | None = None
    detail: str | None = None


class ReportDetailPublic(BaseModel):
    """A report as seen by anyone. Unpublished reports reveal only their status and timeline."""

    id: int
    status: str
    visible: bool
    created_at: UTCDateTime
    report: ReportPublic | None = None
    history: list[ReportEventOut] = []
    message: str | None = None


class ReportDetailAdmin(BaseModel):
    report: ReportAdmin
    history: list[ReportEventOut]


class ReportUpdate(BaseModel):
    status: ReportStatus | None = None
    admin_notes: str | None = Field(default=None, max_length=2000)
    # Admin corrections to the location description (coordinates are never changed).
    state: str | None = Field(default=None, max_length=60)
    district: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=300)


# ---------- Admin ----------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: UTCDateTime
    username: str


class RefreshResult(BaseModel):
    assessed: int
    data_source: str
    warnings: list[str]
    alerts_created: int
    alerts_updated: int
    alerts_resolved: int
