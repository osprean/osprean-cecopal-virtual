"""Auditoría append-only (I7): solo inserción. Acotado por emergencia_id (I6).

No expone update ni delete a propósito.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_log import CecoviLog


class LogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_emergencia(
        self, emergencia_id: int, *, limit: int = 200
    ) -> Sequence[CecoviLog]:
        stmt = (
            select(CecoviLog)
            .where(CecoviLog.emergencia_id == emergencia_id)
            .order_by(CecoviLog.at.desc(), CecoviLog.id.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

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
