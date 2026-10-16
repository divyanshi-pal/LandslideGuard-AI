from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Alert
from ..schemas import AlertOut

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(
    status: Literal["active", "resolved", "all"] = "active",
    state: str | None = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[Alert]:
    stmt = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit)
    if status != "all":
        stmt = stmt.where(Alert.status == status)
    if state:
        stmt = stmt.where(Alert.state == state)
    return list(db.scalars(stmt))
