"""Helper de auditoría (I7): registra una mutación operativa en cecovi_log."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.log_repository import LogRepository


async def audit(
    db: AsyncSession,
    *,
    emergencia_id: int,
    actor_id: int | None,
    accion: str,
    payload: dict[str, Any],
) -> None:
    await LogRepository(db).add(
        emergencia_id=emergencia_id, accion=accion, actor_usuario_id=actor_id, payload=payload
    )
