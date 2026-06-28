"""Operación del área CAMPO. RBAC campo:ver|operar; I7/I3/I6."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.audit import audit
from app.core.exceptions import NotFoundError
from app.deps import DbSession
from app.models.cecovi_campo import CecoviCampoReporte, CecoviCampoTarea
from app.rbac import require_perm
from app.repositories.operativo_repository import OperativoRepo
from app.schemas.campo import (
    EstadoUpdate,
    ReporteCreate,
    ReporteRead,
    TareaCreate,
    TareaRead,
)
from app.tenancy import EmergenciaCtx, SessionCtx

router = APIRouter(prefix="/emergencias", tags=["campo"])

Ver = Annotated[SessionCtx, Depends(require_perm("campo:ver"))]
Operar = Annotated[SessionCtx, Depends(require_perm("campo:operar", write=True))]
P = "/{id_emergencia}/campo"


# --- tareas ---
@router.get(f"{P}/tareas", response_model=list[TareaRead])
async def list_tareas(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[TareaRead]:
    rows = await OperativoRepo(db).list_for(CecoviCampoTarea, emergencia.id)
    return [TareaRead.model_validate(r) for r in rows]


@router.post(f"{P}/tareas", response_model=TareaRead, status_code=status.HTTP_201_CREATED)
async def crear_tarea(
    emergencia: EmergenciaCtx, principal: Operar, payload: TareaCreate, db: DbSession
) -> TareaRead:
    row = CecoviCampoTarea(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="campo:tarea_creada",
        payload={"id": row.id, "code": row.code},
    )
    await db.commit()
    return TareaRead.model_validate(row)


@router.post(f"{P}/tareas/{{tid}}/estado", response_model=TareaRead)
async def estado_tarea(
    emergencia: EmergenciaCtx, principal: Operar, tid: int, payload: EstadoUpdate, db: DbSession
) -> TareaRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviCampoTarea, emergencia.id, tid)
    if row is None:
        raise NotFoundError("Tarea no encontrada", code="tarea_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="campo:tarea_estado",
        payload={"id": tid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return TareaRead.model_validate(row)


# --- reportes ---
@router.get(f"{P}/reportes", response_model=list[ReporteRead])
async def list_reportes(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[ReporteRead]:
    rows = await OperativoRepo(db).list_for(CecoviCampoReporte, emergencia.id)
    return [ReporteRead.model_validate(r) for r in rows]


@router.post(f"{P}/reportes", response_model=ReporteRead, status_code=status.HTTP_201_CREATED)
async def crear_reporte(
    emergencia: EmergenciaCtx, principal: Operar, payload: ReporteCreate, db: DbSession
) -> ReporteRead:
    row = CecoviCampoReporte(
        emergencia_id=emergencia.id, created_by=None, **payload.model_dump()
    )
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="campo:reporte_creado",
        payload={"id": row.id, "kind": row.kind},
    )
    await db.commit()
    return ReporteRead.model_validate(row)
