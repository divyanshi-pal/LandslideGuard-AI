"""Application settings, loaded from environment variables or backend/.env."""

from __future__ import annotations

import logging
import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
logger = logging.getLogger("landslideguard")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "LandslideGuard AI"
    environment: Literal["development", "production", "test"] = "development"

    # Database: SQLite by default; any SQLAlchemy URL works (e.g. PostgreSQL).
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'landslideguard.db').as_posix()}"

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Admin bootstrap account and token signing.
    admin_username: str = "admin"
    admin_password: str = "change-me-now"
    secret_key: str = ""
    token_ttl_minutes: int = 480

    # "demo"       -> deterministic simulated rainfall, always labelled DEMO.
    # "open-meteo" -> live model data from api.open-meteo.com (no API key needed),
    #                 falls back to demo data (labelled) if the request fails.
    weather_provider: Literal["demo", "open-meteo"] = "demo"
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    http_timeout_seconds: float = 15.0

    # Seed monitoring locations, demo reports and an initial assessment on startup.
    seed_demo_data: bool = True

    # Uploads (stored privately; served only through access-checked endpoints)
    upload_dir: Path = BACKEND_DIR / "uploads"
    max_upload_mb: float = 5.0  # photos
    video_uploads_enabled: bool = True
    max_video_mb: float = 25.0
    media_url_ttl_seconds: int = 3600  # lifetime of signed admin media links

    # Nationwide incident reporting
    # Optional GeoJSON (Polygon/MultiPolygon) of India's official boundary. Without it,
    # coordinates are checked against a bounding envelope only (see app/services/geo.py).
    india_boundary_geojson: str = ""
    # Show pending (unverified) reports to the public, clearly labelled. Photos stay private until verified.
    public_show_unverified: bool = False
    # Report submissions allowed per client IP per hour (0 disables the limit).
    report_rate_limit_per_hour: int = 30

    # Optional reverse geocoding (coordinates -> state/district/address).
    # "nominatim" requires GEOCODER_USER_AGENT (OpenStreetMap usage policy: identify your app,
    # max 1 request/second). Leave "none" to disable; users then type state/district manually.
    geocoder_provider: Literal["none", "nominatim"] = "none"
    geocoder_url: str = "https://nominatim.openstreetmap.org/reverse"
    geocoder_search_url: str = "https://nominatim.openstreetmap.org/search"  # place-name search on the map
    geocoder_user_agent: str = ""
    geocoder_email: str = ""

    # ML artifacts produced by `python -m ml.train`
    model_dir: Path = BACKEND_DIR / "ml" / "artifacts"

    @property
    def cors_origin_list(self) -> list[str]:
        # Browsers send Origin without a trailing slash, so "https://x.vercel.app/" must not break CORS.
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def uses_local_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


def validate_settings(settings: Settings) -> Settings:
    """Fill safe development defaults; refuse to start production with unsafe ones."""
    if settings.environment == "production":
        problems = []
        if not settings.secret_key or len(settings.secret_key) < 32:
            problems.append("SECRET_KEY must be set to a random value of at least 32 characters")
        if settings.admin_password in ("", "change-me-now") or len(settings.admin_password) < 10:
            problems.append("ADMIN_PASSWORD must be set to a strong password (at least 10 characters)")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
    elif not settings.secret_key:
        # A per-process random key: admin tokens stop working after a restart.
        settings.secret_key = secrets.token_urlsafe(32)
        if settings.environment != "test":
            logger.warning("SECRET_KEY not set - using a random key for this process only.")
    return settings


@lru_cache
def get_settings() -> Settings:
    return validate_settings(Settings())
