"""FastAPI application entry point.

Run from the backend/ directory:
    .venv\\Scripts\\python -m uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import __version__
from .config import BACKEND_DIR, get_settings
from .database import SessionLocal, init_db
from .routers import admin, alerts, dashboard, geocode, locations, meta, reports, risk
from .seed import seed_all
from .services.geo import load_boundary
from .services.geocoding import ReverseGeocoder
from .services.ml_model import MLModelService
from .services.report_guard import RateLimiter
from .services.weather import provider_from_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("landslideguard")
settings = get_settings()
FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    result = init_db()
    if result.applied:
        logger.info("Database migrations applied: %s (backup: %s)", result.applied, result.backup)
    if settings.india_boundary_geojson:
        load_boundary(settings.india_boundary_geojson)  # fail fast on a bad boundary file
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    app.state.ml_service = MLModelService(settings.model_dir)
    app.state.weather_provider = provider_from_settings(settings)
    app.state.geocoder = ReverseGeocoder(settings)
    app.state.report_limiter = RateLimiter(settings.report_rate_limit_per_hour)
    with SessionLocal() as db:
        seed_all(db, settings, app.state.weather_provider, app.state.ml_service)
    yield


app = FastAPI(
    title="LandslideGuard AI API",
    version=__version__,
    description=(
        "Landslide risk monitoring for Northeast India and citizen incident reporting from anywhere in India. "
        "A prototype - not an official warning service."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meta, locations, dashboard, risk, reports, alerts, admin, geocode):
    app.include_router(r.router)

# Uploaded media are deliberately NOT served as static files. Photos become public only after
# verification (GET /api/reports/{id}/photo); admins use signed links (GET /api/admin/media/...).


# Serve the production frontend build (frontend/dist) if it exists, with SPA fallback.
if FRONTEND_DIST.is_dir():
    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith(("api/", "uploads/")):
            raise HTTPException(404)
        candidate = (FRONTEND_DIST / full_path).resolve()
        if full_path and candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
            return FileResponse(candidate)
        if Path(full_path).suffix:  # a missing file, not a client-side route
            raise HTTPException(404)
        return FileResponse(Path(FRONTEND_DIST) / "index.html")
