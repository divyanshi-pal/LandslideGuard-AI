"""Test configuration: isolated temp database, uploads and model directory.

Environment variables are set before the app is imported so that the cached
settings and the SQLAlchemy engine point at the temporary locations.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

TMP_DIR = Path(tempfile.mkdtemp(prefix="landslideguard_test_"))
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite:///{(TMP_DIR / 'test.db').as_posix()}",
        "UPLOAD_DIR": str(TMP_DIR / "uploads"),
        "MODEL_DIR": str(TMP_DIR / "model"),
        "WEATHER_PROVIDER": "demo",
        "ADMIN_USERNAME": "admin",
        "ADMIN_PASSWORD": "test-password",
        "SECRET_KEY": "test-secret-key",
        "SEED_DEMO_DATA": "true",
        # Pin nationwide-reporting settings so a developer's .env cannot change test behaviour.
        "INDIA_BOUNDARY_GEOJSON": "",
        "PUBLIC_SHOW_UNVERIFIED": "false",
        "REPORT_RATE_LIMIT_PER_HOUR": "1000",
        "VIDEO_UPLOADS_ENABLED": "true",
        "MAX_VIDEO_MB": "1",
        "GEOCODER_PROVIDER": "none",
    }
)

ADMIN = {"username": "admin", "password": "test-password"}


@pytest.fixture(scope="session")
def model_dir() -> Path:
    """Train a small synthetic model once for the whole test session."""
    from ml.synthetic import generate_synthetic_dataset
    from ml.train import train

    out = TMP_DIR / "model"
    train(
        generate_synthetic_dataset(1200, seed=7),
        is_synthetic=True,
        source_detail="test fixture",
        seed=7,
        cv_folds=3,
        out_dir=out,
    )
    return out


@pytest.fixture(scope="session")
def client(model_dir):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_headers(client) -> dict:
    resp = client.post("/api/admin/login", json=ADMIN)
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def pytest_sessionfinish(session, exitstatus):
    from app.database import engine

    engine.dispose()
    shutil.rmtree(TMP_DIR, ignore_errors=True)
