"""Repositorio genérico para entidades operativas cecovi_*.

TODA query acotada por emergencia_id (I6). Reutilizado por todas las áreas
(dirección, sanitario, logística, campo, gabinete).
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base

T = TypeVar("T", bound=Base)


class OperativoRepo:
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
