"""Health endpoints para Kubernetes (liveness + readiness)."""

from __future__ import annotations

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.logging import get_logger
from app.deps import DbSession

router = APIRouter(prefix="/health", tags=["health"])
log = get_logger(__name__)


@router.get("/live", summary="Liveness probe")
async def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe")
async def readiness(db: DbSession) -> JSONResponse:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        log.error("readiness_db_failed", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "db": "down"},
        )
    return JSONResponse(status_code=200, content={"status": "ok", "db": "up"})
