"""Acceso a datos de la entidad raíz `cecovi_emergencia`.

Es la raíz de tenancy: el resto de repos parte del `emergencia_id` que aquí se
resuelve. Ver skill `comacon-db-access` (I6).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_emergencia import CecoviEmergencia


class EmergenciaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_slug(self, slug: str) -> CecoviEmergencia | None:
        stmt = select(CecoviEmergencia).where(CecoviEmergencia.slug == slug)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, emergencia_id: int) -> CecoviEmergencia | None:
        return await self._session.get(CecoviEmergencia, emergencia_id)

    async def get_by_comacon_emergency_id(
        self, comacon_emergency_id: int
    ) -> CecoviEmergencia | None:
        stmt = select(CecoviEmergencia).where(
            CecoviEmergencia.comacon_emergency_id == comacon_emergency_id
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        organization_id: int,
        comacon_emergency_id: int | None,
        slug: str,
        modo: str,
    ) -> CecoviEmergencia:
        em = CecoviEmergencia(
            organization_id=organization_id,
            comacon_emergency_id=comacon_emergency_id,
            slug=slug,
            modo=modo,
            estado="activa",
            nivel="cecopal",
        )
        self._session.add(em)
        await self._session.flush()
        await self._session.refresh(em)
        return em
