"""Operación del área SANITARIO. RBAC sanitario:ver|operar; I7/I3/I6."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.audit import audit
from app.core.exceptions import NotFoundError
from app.deps import DbSession
from app.models.cecovi_sanitario import CecoviSanAlerta, CecoviSanVictima, CecoviSanZona
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.rbac import require_perm
from app.repositories.operativo_repository import OperativoRepo
from app.schemas.sanitario import (
    AlertaCreate,
    AlertaRead,
    EstadoUpdate,
    TriajeUpdate,
    VictimaCreate,
    VictimaRead,
    ZonaCreate,
    ZonaRead,
)
from app.tenancy import EmergenciaCtx

router = APIRouter(prefix="/emergencias", tags=["sanitario"])

Ver = Annotated[CecoviUsuarioTemporal, Depends(require_perm("sanitario:ver"))]
Operar = Annotated[CecoviUsuarioTemporal, Depends(require_perm("sanitario:operar", write=True))]
P = "/{id_emergencia}/sanitario"


# --- víctimas ---
@router.get(f"{P}/victimas", response_model=list[VictimaRead])
async def list_victimas(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[VictimaRead]:
    rows = await OperativoRepo(db).list_for(CecoviSanVictima, emergencia.id)
    return [VictimaRead.model_validate(r) for r in rows]


@router.post(f"{P}/victimas", response_model=VictimaRead, status_code=status.HTTP_201_CREATED)
async def crear_victima(
    emergencia: EmergenciaCtx, principal: Operar, payload: VictimaCreate, db: DbSession
) -> VictimaRead:
    row = CecoviSanVictima(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:victima_registrada",
        payload={"id": row.id, "code": row.code},
    )
    await db.commit()
    return VictimaRead.model_validate(row)


@router.post(f"{P}/victimas/{{vid}}/triaje", response_model=VictimaRead)
async def triaje_victima(
    emergencia: EmergenciaCtx, principal: Operar, vid: int, payload: TriajeUpdate, db: DbSession
) -> VictimaRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviSanVictima, emergencia.id, vid)
    if row is None:
        raise NotFoundError("Víctima no encontrada", code="victima_not_found")
    row.triage = payload.triage
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:triaje_actualizado",
        payload={"id": vid, "triage": payload.triage},
    )
    await db.commit()
    await db.refresh(row)
    return VictimaRead.model_validate(row)


# --- zonas ---
@router.get(f"{P}/zonas", response_model=list[ZonaRead])
async def list_zonas(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[ZonaRead]:
    rows = await OperativoRepo(db).list_for(CecoviSanZona, emergencia.id)
    return [ZonaRead.model_validate(r) for r in rows]


@router.post(f"{P}/zonas", response_model=ZonaRead, status_code=status.HTTP_201_CREATED)
async def crear_zona(
    emergencia: EmergenciaCtx, principal: Operar, payload: ZonaCreate, db: DbSession
) -> ZonaRead:
    row = CecoviSanZona(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:zona_creada",
        payload={"id": row.id},
    )
    await db.commit()
    return ZonaRead.model_validate(row)


@router.post(f"{P}/zonas/{{zid}}/estado", response_model=ZonaRead)
async def estado_zona(
    emergencia: EmergenciaCtx, principal: Operar, zid: int, payload: EstadoUpdate, db: DbSession
) -> ZonaRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviSanZona, emergencia.id, zid)
    if row is None:
        raise NotFoundError("Zona no encontrada", code="zona_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:zona_estado",
        payload={"id": zid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return ZonaRead.model_validate(row)


# --- alertas ---
@router.get(f"{P}/alertas", response_model=list[AlertaRead])
async def list_alertas(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[AlertaRead]:
    rows = await OperativoRepo(db).list_for(CecoviSanAlerta, emergencia.id)
    return [AlertaRead.model_validate(r) for r in rows]


@router.post(f"{P}/alertas", response_model=AlertaRead, status_code=status.HTTP_201_CREATED)
async def crear_alerta(
    emergencia: EmergenciaCtx, principal: Operar, payload: AlertaCreate, db: DbSession
) -> AlertaRead:
    row = CecoviSanAlerta(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:alerta_creada",
        payload={"id": row.id},
    )
    await db.commit()
    return AlertaRead.model_validate(row)


@router.post(f"{P}/alertas/{{aid}}/ack", response_model=AlertaRead)
async def ack_alerta(
    emergencia: EmergenciaCtx, principal: Operar, aid: int, db: DbSession
) -> AlertaRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviSanAlerta, emergencia.id, aid)
    if row is None:
        raise NotFoundError("Alerta no encontrada", code="alerta_not_found")
    row.acknowledged = True
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="sanitario:alerta_ack",
        payload={"id": aid},
    )
    await db.commit()
    await db.refresh(row)
    return AlertaRead.model_validate(row)
