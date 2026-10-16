"""Small, dependency-free schema migrations (run automatically at startup).

* Fresh database: ``create_all`` builds the latest schema and every migration is recorded as applied.
* Existing database: pending migrations add missing columns and indexes in place with
  ``ALTER TABLE ... ADD COLUMN`` / ``CREATE INDEX``. Existing rows are kept; the only data
  changes are the documented backfills. A SQLite file is copied to
  ``<file>.backup-<UTC timestamp>`` before anything is changed.
* Every step checks what already exists, so re-running is safe.

Applied versions are stored in the ``schema_migrations`` table. A database created before
migrations existed (no such table, but app tables present) is treated as version 1.
"""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Engine, MetaData, inspect, text
from sqlalchemy.engine import Connection

logger = logging.getLogger("landslideguard.migrations")

VERSION_TABLE = "schema_migrations"

# Columns added in version 2 (nationwide incident reporting). Types/defaults come from the models.
V2_COLUMNS = {
    "citizen_reports": [
        "observed_at", "location_source", "location_accuracy_m", "location_check", "state", "district",
        "address", "address_source", "photo_content_type", "photo_size_bytes", "photo_width",
        "photo_height", "photo_sha256", "photo_exif_datetime", "video_filename", "video_content_type",
        "video_size_bytes", "video_sha256", "client_submission_id", "possible_duplicate_of",
        "reviewed_by", "reviewed_at",
    ],
    "alerts": ["official_source", "official_reference"],
}
V2_INDEXES = {
    "citizen_reports": [
        "ix_citizen_reports_observed_at", "ix_citizen_reports_state",
        "ix_citizen_reports_photo_sha256", "ix_citizen_reports_client_submission_id",
    ],
}
V2_BACKFILL = [
    # Older reports have no separate incident time; use the time they were received.
    "UPDATE citizen_reports SET observed_at = created_at WHERE observed_at IS NULL",
]


@dataclass
class MigrationResult:
    fresh: bool = False
    applied: list[int] = field(default_factory=list)
    backup: Path | None = None


def _add_columns(conn: Connection, metadata: MetaData, spec: dict[str, list[str]]) -> None:
    insp = inspect(conn)
    for table_name, columns in spec.items():
        existing = {c["name"] for c in insp.get_columns(table_name)}
        table = metadata.tables[table_name]
        for name in columns:
            if name in existing:
                continue
            col = table.c[name]
            ddl = f"ALTER TABLE {table_name} ADD COLUMN {name} {col.type.compile(dialect=conn.dialect)}"
            if col.server_default is not None:
                ddl += f" NOT NULL DEFAULT '{col.server_default.arg}'"
            conn.execute(text(ddl))
            logger.info("Added column %s.%s", table_name, name)


def _create_indexes(conn: Connection, metadata: MetaData, spec: dict[str, list[str]]) -> None:
    for table_name, names in spec.items():
        for index in metadata.tables[table_name].indexes:
            if index.name in names:
                index.create(bind=conn, checkfirst=True)


def _migration_2(conn: Connection, metadata: MetaData) -> None:
    _add_columns(conn, metadata, V2_COLUMNS)
    _create_indexes(conn, metadata, V2_INDEXES)
    for sql in V2_BACKFILL:
        conn.execute(text(sql))


def _migration_3(conn: Connection, metadata: MetaData) -> None:
    """Add the report history table and seed it with what is already known about each report."""
    metadata.tables["report_events"].create(bind=conn, checkfirst=True)
    conn.execute(text(
        "INSERT INTO report_events (report_id, created_at, kind, to_status, detail) "
        "SELECT id, created_at, 'submitted', 'pending', NULL FROM citizen_reports"
    ))
    # Only the latest review was stored before this version; earlier steps are unknown.
    conn.execute(text(
        "INSERT INTO report_events (report_id, created_at, kind, to_status, actor, detail) "
        "SELECT id, reviewed_at, 'status_changed', status, reviewed_by, 'Recorded before history tracking' "
        "FROM citizen_reports WHERE reviewed_at IS NOT NULL"
    ))


MIGRATIONS = [
    (1, "baseline schema", None),
    (2, "nationwide incident reporting: location source, state/district, media metadata, review, official alerts", _migration_2),
    (3, "report verification history (report_events)", _migration_3),
]
LATEST_VERSION = MIGRATIONS[-1][0]


def _backup_sqlite(engine: Engine) -> Path | None:
    url = engine.url
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        return None
    path = Path(url.database)
    if not path.exists():
        return None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup = path.with_name(f"{path.name}.backup-{stamp}")
    shutil.copy2(path, backup)
    return backup


def _record(conn: Connection, version: int, description: str) -> None:
    conn.execute(
        text(f"INSERT INTO {VERSION_TABLE} (version, description, applied_at) VALUES (:v, :d, :t)"),
        {"v": version, "d": description, "t": datetime.now(timezone.utc).isoformat(timespec="seconds")},
    )


def migrate(engine: Engine, metadata: MetaData) -> MigrationResult:
    result = MigrationResult()
    tables = set(inspect(engine).get_table_names())
    app_tables = set(metadata.tables) & tables
    applied: set[int] = set()
    if VERSION_TABLE in tables:
        with engine.connect() as conn:
            applied = {row[0] for row in conn.execute(text(f"SELECT version FROM {VERSION_TABLE}"))}

    baseline = bool(app_tables) and not applied  # created before migrations existed -> version 1
    pending = [m for m in MIGRATIONS if m[0] not in (applied or ({1} if baseline else set()))]
    if app_tables and pending:
        result.backup = _backup_sqlite(engine)  # before any write
        if result.backup:
            logger.info("Database backed up to %s before migrating", result.backup)

    with engine.begin() as conn:
        conn.execute(text(
            f"CREATE TABLE IF NOT EXISTS {VERSION_TABLE} "
            "(version INTEGER PRIMARY KEY, description VARCHAR(200) NOT NULL, applied_at VARCHAR(40) NOT NULL)"
        ))
        if baseline:
            _record(conn, 1, MIGRATIONS[0][1])

    if not app_tables:
        # Brand-new database: build the latest schema directly.
        metadata.create_all(engine)
        with engine.begin() as conn:
            for version, description, _ in pending:
                _record(conn, version, description)
        result.fresh = True
        return result

    for version, description, step in pending:
        with engine.begin() as conn:  # one transaction per migration
            if step is not None:
                step(conn, metadata)
            _record(conn, version, description)
        result.applied.append(version)
        logger.info("Applied migration %d: %s", version, description)

    metadata.create_all(engine)  # creates any brand-new tables; never alters existing ones
    return result
