"""Acceso a datos del área de seguridad. TODA query acotada por emergencia_id (I6)."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base
from app.models.cecovi_seguridad import (
    CecoviSegAcceso,
    CecoviSegCorte,
    CecoviSegIncidencia,
    CecoviSegPerimetro,
)

T = TypeVar("T", bound=Base)


class SeguridadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for(self, model: type[T], emergencia_id: int) -> Sequence[T]:
        stmt = (
            select(model)
            .where(model.emergencia_id == emergencia_id)  # type: ignore[attr-defined]
            .order_by(model.id.desc())  # type: ignore[attr-defined]
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def get_for(self, model: type[T], emergencia_id: int, row_id: int) -> T | None:
        row = await self._session.get(model, row_id)
        if row is None or row.emergencia_id != emergencia_id:  # type: ignore[attr-defined]
            return None
        return row

    async def add(self, row: T) -> T:
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row


# Modelos por área (para que el router los referencie sin acoplarse al repo).
SEG_MODELS = {
    "perimetro": CecoviSegPerimetro,
    "acceso": CecoviSegAcceso,
    "corte": CecoviSegCorte,
    "incidencia": CecoviSegIncidencia,
}
