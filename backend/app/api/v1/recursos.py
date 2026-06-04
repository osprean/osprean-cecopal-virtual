"""Transversal: lectura de recursos de COMACON (solo lectura) y consulta de logs.

Recursos: require_perm("recursos:ver"), acotado por organization_id de la
emergencia (I6), SOLO LECTURA (la edición es F5). Logs: require_perm("logs:ver").
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.deps import DbSession
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.rbac import require_perm
from app.repositories.comacon_resource_repository import ComaconResourceRepository
from app.repositories.log_repository import LogRepository
from app.schemas.seguridad import LogRead, RecursoComaconRead
from app.tenancy import EmergenciaCtx

router = APIRouter(prefix="/emergencias", tags=["recursos"])


@router.get(
    "/{id_emergencia}/recursos",
    response_model=list[RecursoComaconRead],
    summary="Recursos de COMACON de la organización (solo lectura)",
)
async def list_recursos(
    emergencia: EmergenciaCtx,
    _principal: Annotated[CecoviUsuarioTemporal, Depends(require_perm("recursos:ver"))],
    db: DbSession,
) -> list[RecursoComaconRead]:
    rows = await ComaconResourceRepository(db).list_by_org(emergencia.organization_id)
    return [RecursoComaconRead.model_validate(r) for r in rows]


@router.get(
    "/{id_emergencia}/logs",
    response_model=list[LogRead],
    summary="Historial/auditoría de la emergencia",
)
async def list_logs(
    emergencia: EmergenciaCtx,
    _principal: Annotated[CecoviUsuarioTemporal, Depends(require_perm("logs:ver"))],
    db: DbSession,
) -> list[LogRead]:
    rows = await LogRepository(db).list_by_emergencia(emergencia.id)
    return [LogRead.model_validate(r) for r in rows]
