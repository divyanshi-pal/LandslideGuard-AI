"""The migration must upgrade a database created by the original schema without losing data."""

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.database import Base
from app.migrations import LATEST_VERSION, migrate
from app.models import Alert, CitizenReport

# Exact DDL of the original (version 1) tables, copied from a real database created by v0.1.0.
V1_DDL = [
    """CREATE TABLE locations (id INTEGER NOT NULL, name VARCHAR(120) NOT NULL, district VARCHAR(120) NOT NULL,
       state VARCHAR(60) NOT NULL, latitude FLOAT NOT NULL, longitude FLOAT NOT NULL, slope_deg FLOAT NOT NULL,
       soil_type VARCHAR(20) NOT NULL, vegetation_ndvi FLOAT NOT NULL, slope_modified BOOLEAN NOT NULL,
       attributes_source VARCHAR(60) NOT NULL, PRIMARY KEY (id))""",
    """CREATE TABLE citizen_reports (id INTEGER NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
       category VARCHAR(40) NOT NULL, description TEXT NOT NULL, observed_severity VARCHAR(20) NOT NULL,
       latitude FLOAT NOT NULL, longitude FLOAT NOT NULL, location_text VARCHAR(200), reporter_name VARCHAR(120),
       reporter_contact VARCHAR(120), photo_filename VARCHAR(80), status VARCHAR(20) NOT NULL, admin_notes TEXT,
       is_demo BOOLEAN NOT NULL, PRIMARY KEY (id))""",
    "CREATE INDEX ix_citizen_reports_created_at ON citizen_reports (created_at)",
    "CREATE INDEX ix_citizen_reports_status ON citizen_reports (status)",
    """CREATE TABLE admin_users (id INTEGER NOT NULL, username VARCHAR(60) NOT NULL, password_hash VARCHAR(200) NOT NULL,
       created_at DATETIME NOT NULL, PRIMARY KEY (id), UNIQUE (username))""",
    """CREATE TABLE alerts (id INTEGER NOT NULL, created_at DATETIME NOT NULL, title VARCHAR(200) NOT NULL,
       message TEXT NOT NULL, level VARCHAR(20) NOT NULL, state VARCHAR(60), location_id INTEGER, latitude FLOAT,
       longitude FLOAT, source VARCHAR(20) NOT NULL, is_demo BOOLEAN NOT NULL, status VARCHAR(20) NOT NULL,
       resolved_at DATETIME, PRIMARY KEY (id), FOREIGN KEY(location_id) REFERENCES locations (id))""",
]


def make_v1_database(path):
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with engine.begin() as conn:
        for ddl in V1_DDL:
            conn.execute(text(ddl))
        conn.execute(text(
            "INSERT INTO citizen_reports VALUES (7, '2026-10-01 10:00:00.000000', '2026-10-01 10:00:00.000000', "
            "'landslide', 'Old report from before the upgrade', 'severe', 25.57, 91.88, 'Near the bridge', "
            "'Asha', '9800000000', 'abc.png', 'verified', 'checked', 0)"
        ))
        conn.execute(text(
            "INSERT INTO alerts VALUES (3, '2026-10-01 11:00:00.000000', 'Old alert', 'Message', 'High', "
            "'Assam', NULL, NULL, NULL, 'admin', 0, 'active', NULL)"
        ))
    return engine


def test_upgrades_v1_database_without_losing_data(tmp_path):
    engine = make_v1_database(tmp_path / "old.db")
    result = migrate(engine, Base.metadata)

    assert result.applied == [2, 3] and not result.fresh
    assert result.backup is not None and result.backup.exists()  # copy taken before changes

    cols = {c["name"] for c in inspect(engine).get_columns("citizen_reports")}
    assert {"observed_at", "location_source", "state", "district", "photo_sha256", "client_submission_id",
            "reviewed_by", "video_filename"} <= cols
    with Session(engine) as db:
        report = db.get(CitizenReport, 7)
        assert report.description == "Old report from before the upgrade"
        assert report.reporter_contact == "9800000000" and report.photo_filename == "abc.png"
        assert report.status == "verified" and report.admin_notes == "checked"
        assert report.location_source == "unknown"  # never pretend old coordinates came from GPS
        assert report.observed_at is not None  # backfilled from created_at
        alert = db.get(Alert, 3)
        assert alert.title == "Old alert" and alert.official_source is None
        assert db.scalar(text("SELECT max(version) FROM schema_migrations")) == LATEST_VERSION
        # History is seeded with the submission of every existing report.
        assert [(e.kind, e.to_status) for e in report.events] == [("submitted", "pending")]


def test_migration_is_idempotent(tmp_path):
    engine = make_v1_database(tmp_path / "old.db")
    migrate(engine, Base.metadata)
    again = migrate(engine, Base.metadata)
    assert again.applied == [] and again.backup is None
    with Session(engine) as db:
        assert db.scalar(select(CitizenReport.id)) == 7


def test_fresh_database_gets_latest_schema(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'new.db').as_posix()}")
    result = migrate(engine, Base.metadata)
    assert result.fresh and result.backup is None
    assert "citizen_reports" in inspect(engine).get_table_names()
    with engine.connect() as conn:
        versions = [r[0] for r in conn.execute(text("SELECT version FROM schema_migrations ORDER BY version"))]
    assert versions == list(range(1, LATEST_VERSION + 1))


def test_unique_submission_id_index_exists_after_upgrade(tmp_path):
    engine = make_v1_database(tmp_path / "old.db")
    migrate(engine, Base.metadata)
    indexes = {i["name"]: i for i in inspect(engine).get_indexes("citizen_reports")}
    assert indexes["ix_citizen_reports_client_submission_id"]["unique"]
