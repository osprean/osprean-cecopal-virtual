"""Acceso a datos de usuarios temporales. Toda query acotada por emergencia_id (I6)."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal


class UsuarioTemporalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self, *, emergencia_id: int, nombre: str, email: str, nivel: str, roles_confirmados: bool
    ) -> CecoviUsuarioTemporal:
        u = CecoviUsuarioTemporal(
            emergencia_id=emergencia_id,
            nombre=nombre,
            email=email,
            nivel=nivel,
            roles_confirmados=roles_confirmados,
        )
        self._session.add(u)
        await self._session.flush()
        await self._session.refresh(u)
        return u

    async def get_in_emergencia(
        self, *, emergencia_id: int, usuario_id: int
    ) -> CecoviUsuarioTemporal | None:
        stmt = select(CecoviUsuarioTemporal).where(
            CecoviUsuarioTemporal.id == usuario_id,
            CecoviUsuarioTemporal.emergencia_id == emergencia_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_emergencia(self, emergencia_id: int) -> Sequence[CecoviUsuarioTemporal]:
        stmt = (
            select(CecoviUsuarioTemporal)
            .where(CecoviUsuarioTemporal.emergencia_id == emergencia_id)
            .order_by(CecoviUsuarioTemporal.id)
        )
        result = await self._session.execute(stmt)
        return result.scalars().all()
