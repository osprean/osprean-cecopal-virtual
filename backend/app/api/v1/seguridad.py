"""Operación del área de SEGURIDAD.

RBAC: lectura require_perm("seguridad:ver"), mutaciones require_perm(
"seguridad:operar", write=True) — el write además exige no-solo-lectura (I3).
Toda mutación se audita en cecovi_log (I7); todo se acota por emergencia_id (I6).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, status

from app.core.exceptions import NotFoundError
from app.deps import DbSession
from app.models.cecovi_seguridad import (
    CecoviSegAcceso,
    CecoviSegCorte,
    CecoviSegIncidencia,
    CecoviSegPerimetro,
)
from app.rbac import require_perm
from app.repositories.log_repository import LogRepository
from app.repositories.seguridad_repository import SeguridadRepository
from app.schemas.seguridad import (
    AccesoCreate,
    AccesoRead,
    CorteCreate,
    CorteRead,
    EstadoUpdate,
    IncidenciaCreate,
    IncidenciaRead,
    PerimetroCreate,
    PerimetroRead,
)
from app.tenancy import EmergenciaCtx, SessionCtx

router = APIRouter(prefix="/emergencias", tags=["seguridad"])

Ver = Annotated[SessionCtx, Depends(require_perm("seguridad:ver"))]
Operar = Annotated[SessionCtx, Depends(require_perm("seguridad:operar", write=True))]
P = "/{id_emergencia}/seguridad"


async def _audit(
    db: DbSession, emergencia_id: int, actor_id: int | None, accion: str, payload: dict[str, Any]
) -> None:
    await LogRepository(db).add(
        emergencia_id=emergencia_id, accion=accion, actor_usuario_id=actor_id, payload=payload
    )


# ---------------- Perímetros ----------------
@router.get(f"{P}/perimetros", response_model=list[PerimetroRead], summary="Listar perímetros")
async def list_perimetros(
    emergencia: EmergenciaCtx, _principal: Ver, db: DbSession
) -> list[PerimetroRead]:
    rows = await SeguridadRepository(db).list_for(CecoviSegPerimetro, emergencia.id)
    return [PerimetroRead.model_validate(r) for r in rows]


@router.post(f"{P}/perimetros", response_model=PerimetroRead, status_code=status.HTTP_201_CREATED)
async def crear_perimetro(
    emergencia: EmergenciaCtx, principal: Operar, payload: PerimetroCreate, db: DbSession
) -> PerimetroRead:
    row = CecoviSegPerimetro(
        emergencia_id=emergencia.id,
        kind=payload.kind,
        label=payload.label,
        shape=payload.shape,
        points=[p.model_dump() for p in payload.points] if payload.points else None,
        center_lat=payload.center_lat,
        center_lng=payload.center_lng,
        radius_m=payload.radius_m,
        nivel=payload.nivel,
        color=payload.color,
    )
    await SeguridadRepository(db).add(row)
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:perimetro_creado",
        {"id": row.id, "label": row.label},
    )
    await db.commit()
    return PerimetroRead.model_validate(row)


@router.post(f"{P}/perimetros/{{pid}}/estado", response_model=PerimetroRead)
async def estado_perimetro(
    emergencia: EmergenciaCtx, principal: Operar, pid: int, payload: EstadoUpdate, db: DbSession
) -> PerimetroRead:
    repo = SeguridadRepository(db)
    row = await repo.get_for(CecoviSegPerimetro, emergencia.id, pid)
    if row is None:
        raise NotFoundError("Perímetro no encontrado", code="perimetro_not_found")
    row.estado = payload.estado
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:perimetro_estado",
        {"id": pid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return PerimetroRead.model_validate(row)


# ---------------- Controles de acceso ----------------
@router.get(f"{P}/accesos", response_model=list[AccesoRead], summary="Listar accesos")
async def list_accesos(
    emergencia: EmergenciaCtx, _principal: Ver, db: DbSession
) -> list[AccesoRead]:
    rows = await SeguridadRepository(db).list_for(CecoviSegAcceso, emergencia.id)
    return [AccesoRead.model_validate(r) for r in rows]


@router.post(f"{P}/accesos", response_model=AccesoRead, status_code=status.HTTP_201_CREATED)
async def crear_acceso(
    emergencia: EmergenciaCtx, principal: Operar, payload: AccesoCreate, db: DbSession
) -> AccesoRead:
    row = CecoviSegAcceso(
        emergencia_id=emergencia.id,
        kind=payload.kind,
        label=payload.label,
        lat=payload.lat,
        lng=payload.lng,
        units=payload.units,
        reason=payload.reason,
    )
    await SeguridadRepository(db).add(row)
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:acceso_creado",
        {"id": row.id, "label": row.label},
    )
    await db.commit()
    return AccesoRead.model_validate(row)


@router.post(f"{P}/accesos/{{aid}}/estado", response_model=AccesoRead)
async def estado_acceso(
    emergencia: EmergenciaCtx, principal: Operar, aid: int, payload: EstadoUpdate, db: DbSession
) -> AccesoRead:
    repo = SeguridadRepository(db)
    row = await repo.get_for(CecoviSegAcceso, emergencia.id, aid)
    if row is None:
        raise NotFoundError("Acceso no encontrado", code="acceso_not_found")
    row.estado = payload.estado
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:acceso_estado",
        {"id": aid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return AccesoRead.model_validate(row)


# ---------------- Cortes viales ----------------
@router.get(f"{P}/cortes", response_model=list[CorteRead], summary="Listar cortes viales")
async def list_cortes(emergencia: EmergenciaCtx, _principal: Ver, db: DbSession) -> list[CorteRead]:
    rows = await SeguridadRepository(db).list_for(CecoviSegCorte, emergencia.id)
    return [CorteRead.model_validate(r) for r in rows]


@router.post(f"{P}/cortes", response_model=CorteRead, status_code=status.HTTP_201_CREATED)
async def crear_corte(
    emergencia: EmergenciaCtx, principal: Operar, payload: CorteCreate, db: DbSession
) -> CorteRead:
    row = CecoviSegCorte(
        emergencia_id=emergencia.id,
        road=payload.road,
        km=payload.km,
        lat=payload.lat,
        lng=payload.lng,
        segment=payload.segment,
        reason=payload.reason,
    )
    await SeguridadRepository(db).add(row)
    await _audit(
        db, emergencia.id, principal.usuario_id, "seguridad:corte_creado", {"id": row.id, "road": row.road}
    )
    await db.commit()
    return CorteRead.model_validate(row)


@router.post(f"{P}/cortes/{{cid}}/estado", response_model=CorteRead)
async def estado_corte(
    emergencia: EmergenciaCtx, principal: Operar, cid: int, payload: EstadoUpdate, db: DbSession
) -> CorteRead:
    repo = SeguridadRepository(db)
    row = await repo.get_for(CecoviSegCorte, emergencia.id, cid)
    if row is None:
        raise NotFoundError("Corte no encontrado", code="corte_not_found")
    row.estado = payload.estado
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:corte_estado",
        {"id": cid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return CorteRead.model_validate(row)


# ---------------- Incidencias ----------------
@router.get(f"{P}/incidencias", response_model=list[IncidenciaRead], summary="Listar incidencias")
async def list_incidencias(
    emergencia: EmergenciaCtx, _principal: Ver, db: DbSession
) -> list[IncidenciaRead]:
    rows = await SeguridadRepository(db).list_for(CecoviSegIncidencia, emergencia.id)
    return [IncidenciaRead.model_validate(r) for r in rows]


@router.post(f"{P}/incidencias", response_model=IncidenciaRead, status_code=status.HTTP_201_CREATED)
async def crear_incidencia(
    emergencia: EmergenciaCtx, principal: Operar, payload: IncidenciaCreate, db: DbSession
) -> IncidenciaRead:
    row = CecoviSegIncidencia(
        emergencia_id=emergencia.id,
        title=payload.title,
        tipo=payload.tipo,
        severity=payload.severity,
        lat=payload.lat,
        lng=payload.lng,
        description=payload.description,
    )
    await SeguridadRepository(db).add(row)
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:incidencia_creada",
        {"id": row.id, "title": row.title},
    )
    await db.commit()
    return IncidenciaRead.model_validate(row)


@router.post(f"{P}/incidencias/{{iid}}/estado", response_model=IncidenciaRead)
async def estado_incidencia(
    emergencia: EmergenciaCtx, principal: Operar, iid: int, payload: EstadoUpdate, db: DbSession
) -> IncidenciaRead:
    repo = SeguridadRepository(db)
    row = await repo.get_for(CecoviSegIncidencia, emergencia.id, iid)
    if row is None:
        raise NotFoundError("Incidencia no encontrada", code="incidencia_not_found")
    row.estado = payload.estado
    await _audit(
        db,
        emergencia.id,
        principal.usuario_id,
        "seguridad:incidencia_estado",
        {"id": iid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return IncidenciaRead.model_validate(row)
