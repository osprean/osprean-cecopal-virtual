"""Acceso a datos de selecciones de rol.

TENANCY (I6): TODA query exige `emergencia_id` y filtra por él — no existe un
método que devuelva filas sin acotar por emergencia. La unicidad del jefe (I1)
la garantiza el índice único parcial `uq_cecovi_jefe_activo` a nivel de DB; este
repo no la reimplementa en código.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_rol_seleccion import CecoviRolSeleccion


class RolSeleccionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_emergencia(self, emergencia_id: int) -> Sequence[CecoviRolSeleccion]:
        stmt = (
            select(CecoviRolSeleccion)
            .where(CecoviRolSeleccion.emergencia_id == emergencia_id)
            .order_by(CecoviRolSeleccion.id)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def list_for_usuario(
        self, *, emergencia_id: int, usuario_temporal_id: int
    ) -> Sequence[CecoviRolSeleccion]:
        stmt = select(CecoviRolSeleccion).where(
            CecoviRolSeleccion.emergencia_id == emergencia_id,
            CecoviRolSeleccion.usuario_temporal_id == usuario_temporal_id,
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()

    async def add(
        self,
        *,
        emergencia_id: int,
        usuario_temporal_id: int,
        rol: str,
        activo: bool = True,
    ) -> CecoviRolSeleccion:
        row = CecoviRolSeleccion(
            emergencia_id=emergencia_id,
            usuario_temporal_id=usuario_temporal_id,
            rol=rol,
            activo=activo,
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return row
