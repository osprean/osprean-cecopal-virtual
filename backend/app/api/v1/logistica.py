"""Operación del área LOGÍSTICA. RBAC logistica:ver|operar; I7/I3/I6."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.audit import audit
from app.core.exceptions import AppError, NotFoundError
from app.deps import DbSession
from app.models.cecovi_logistica import (
    CecoviLogiServicio,
    CecoviLogiSolicitud,
    CecoviLogiSuministro,
)
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.rbac import require_perm
from app.repositories.operativo_repository import OperativoRepo
from app.schemas.logistica import (
    EstadoUpdate,
    ServicioCreate,
    ServicioRead,
    SolicitudCreate,
    SolicitudRead,
    StockAjuste,
    SuministroCreate,
    SuministroRead,
)
from app.tenancy import EmergenciaCtx

router = APIRouter(prefix="/emergencias", tags=["logistica"])

Ver = Annotated[CecoviUsuarioTemporal, Depends(require_perm("logistica:ver"))]
Operar = Annotated[CecoviUsuarioTemporal, Depends(require_perm("logistica:operar", write=True))]
P = "/{id_emergencia}/logistica"


# --- suministros ---
@router.get(f"{P}/suministros", response_model=list[SuministroRead])
async def list_suministros(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[SuministroRead]:
    rows = await OperativoRepo(db).list_for(CecoviLogiSuministro, emergencia.id)
    return [SuministroRead.model_validate(r) for r in rows]


@router.post(f"{P}/suministros", response_model=SuministroRead, status_code=status.HTTP_201_CREATED)
async def crear_suministro(
    emergencia: EmergenciaCtx, principal: Operar, payload: SuministroCreate, db: DbSession
) -> SuministroRead:
    row = CecoviLogiSuministro(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:suministro_creado",
        payload={"id": row.id, "name": row.name},
    )
    await db.commit()
    return SuministroRead.model_validate(row)


@router.post(f"{P}/suministros/{{sid}}/stock", response_model=SuministroRead)
async def ajustar_stock(
    emergencia: EmergenciaCtx, principal: Operar, sid: int, payload: StockAjuste, db: DbSession
) -> SuministroRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviLogiSuministro, emergencia.id, sid)
    if row is None:
        raise NotFoundError("Suministro no encontrado", code="suministro_not_found")
    nuevo = row.stock + payload.delta
    if nuevo < 0:
        raise AppError("Stock no puede ser negativo", code="stock_negativo")
    row.stock = nuevo
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:stock_ajustado",
        payload={"id": sid, "delta": payload.delta, "stock": nuevo},
    )
    await db.commit()
    await db.refresh(row)
    return SuministroRead.model_validate(row)


# --- solicitudes ---
@router.get(f"{P}/solicitudes", response_model=list[SolicitudRead])
async def list_solicitudes(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[SolicitudRead]:
    rows = await OperativoRepo(db).list_for(CecoviLogiSolicitud, emergencia.id)
    return [SolicitudRead.model_validate(r) for r in rows]


@router.post(f"{P}/solicitudes", response_model=SolicitudRead, status_code=status.HTTP_201_CREATED)
async def crear_solicitud(
    emergencia: EmergenciaCtx, principal: Operar, payload: SolicitudCreate, db: DbSession
) -> SolicitudRead:
    row = CecoviLogiSolicitud(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:solicitud_creada",
        payload={"id": row.id},
    )
    await db.commit()
    return SolicitudRead.model_validate(row)


@router.post(f"{P}/solicitudes/{{sid}}/decidir", response_model=SolicitudRead)
async def decidir_solicitud(
    emergencia: EmergenciaCtx, principal: Operar, sid: int, payload: EstadoUpdate, db: DbSession
) -> SolicitudRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviLogiSolicitud, emergencia.id, sid)
    if row is None:
        raise NotFoundError("Solicitud no encontrada", code="solicitud_not_found")
    row.estado = payload.estado
    row.decided_at = datetime.now(UTC)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:solicitud_decidida",
        payload={"id": sid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return SolicitudRead.model_validate(row)


# --- servicios críticos ---
@router.get(f"{P}/servicios", response_model=list[ServicioRead])
async def list_servicios(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[ServicioRead]:
    rows = await OperativoRepo(db).list_for(CecoviLogiServicio, emergencia.id)
    return [ServicioRead.model_validate(r) for r in rows]


@router.post(f"{P}/servicios", response_model=ServicioRead, status_code=status.HTTP_201_CREATED)
async def crear_servicio(
    emergencia: EmergenciaCtx, principal: Operar, payload: ServicioCreate, db: DbSession
) -> ServicioRead:
    row = CecoviLogiServicio(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:servicio_creado",
        payload={"id": row.id},
    )
    await db.commit()
    return ServicioRead.model_validate(row)


@router.post(f"{P}/servicios/{{sid}}/estado", response_model=ServicioRead)
async def estado_servicio(
    emergencia: EmergenciaCtx, principal: Operar, sid: int, payload: EstadoUpdate, db: DbSession
) -> ServicioRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviLogiServicio, emergencia.id, sid)
    if row is None:
        raise NotFoundError("Servicio no encontrado", code="servicio_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="logistica:servicio_estado",
        payload={"id": sid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return ServicioRead.model_validate(row)
