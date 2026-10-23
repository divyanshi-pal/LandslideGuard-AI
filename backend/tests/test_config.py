"""Production configuration safety checks."""

import pytest

from app.config import Settings, validate_settings

STRONG = {"secret_key": "x" * 40, "admin_password": "a-strong-password-123"}


def make(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_production_requires_secret_key_and_admin_password():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        validate_settings(make(environment="production", secret_key="", admin_password=STRONG["admin_password"]))
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        validate_settings(make(environment="production", secret_key=STRONG["secret_key"], admin_password="change-me-now"))
    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD"):
        validate_settings(make(environment="production", secret_key=STRONG["secret_key"], admin_password="short"))


def test_valid_production_settings_are_kept_unchanged():
    s = validate_settings(make(environment="production", **STRONG))
    assert s.secret_key == STRONG["secret_key"]


def test_development_gets_a_random_key_when_none_is_set():
    s = validate_settings(make(environment="development", secret_key=""))
    assert len(s.secret_key) >= 32


def test_cors_origins_ignore_trailing_slashes_and_spaces():
    s = make(cors_origins=" https://landslide-guard-ai-plum.vercel.app/ , http://localhost:5173 ,")
    assert s.cors_origin_list == ["https://landslide-guard-ai-plum.vercel.app", "http://localhost:5173"]


def test_sqlite_detection():
    assert make(database_url="sqlite:///x.db").uses_local_sqlite
    assert not make(database_url="postgresql+psycopg://u:p@h/db").uses_local_sqlite
