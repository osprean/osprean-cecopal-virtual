"""Auditoría append-only (I7): solo inserción. Acotado por emergencia_id (I6).

No expone update ni delete a propósito.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_log import CecoviLog


class LogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self,
        *,
        emergencia_id: int,
        accion: str,
        actor_usuario_id: int | None = None,
        payload: dict[str, Any] | None = None,
    ) -> CecoviLog:
        entry = CecoviLog(
            emergencia_id=emergencia_id,
            actor_usuario_id=actor_usuario_id,
            accion=accion,
            payload=payload or {},
        )
        self._session.add(entry)
        await self._session.flush()
        return entry
