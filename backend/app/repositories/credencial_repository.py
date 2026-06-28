"""Acceso a datos de credenciales temporales. Acotado por emergencia_id (I6)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_credencial import CecoviCredencial


class CredencialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        emergencia_id: int,
        usuario_temporal_id: int | None,
        token_hash: str,
        expira_at: datetime,
        tipo: str = "master",
        roles: str = "",
    ) -> CecoviCredencial:
        cred = CecoviCredencial(
            emergencia_id=emergencia_id,
            usuario_temporal_id=usuario_temporal_id,
            token_hash=token_hash,
            estado="emitida",
            expira_at=expira_at,
            tipo=tipo,
            roles=roles,
        )
        self._session.add(cred)
        await self._session.flush()
        await self._session.refresh(cred)
        return cred

    async def get_in_emergencia(
        self, *, emergencia_id: int, credencial_id: int
    ) -> CecoviCredencial | None:
        cred = await self._session.get(CecoviCredencial, credencial_id)
        if cred is None or cred.emergencia_id != emergencia_id:
            return None
        return cred
