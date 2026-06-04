"""Operación del área de DIRECCIÓN (vista del jefe).

RBAC: require_perm("direccion:ver"|"direccion:operar") — solo el jefe los tiene.
Mutaciones auditadas (I7); write exige no-solo-lectura (I3); todo por
emergencia_id (I6).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.audit import audit
from app.core.exceptions import NotFoundError
from app.deps import DbSession
from app.models.cecovi_direccion import (
    CecoviDirAlbergue,
    CecoviDirComunicado,
    CecoviDirEvacuacion,
    CecoviDirGrupo,
    CecoviDirSolicitudMedios,
)
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.rbac import require_perm
from app.repositories.operativo_repository import OperativoRepo
from app.schemas.direccion import (
    AlbergueCreate,
    AlbergueRead,
    ComunicadoCreate,
    ComunicadoRead,
    EstadoUpdate,
    EvacuacionCreate,
    EvacuacionRead,
    EvacuadosUpdate,
    GrupoCreate,
    GrupoRead,
    OcupacionUpdate,
    SolicitudMediosCreate,
    SolicitudMediosRead,
)
from app.tenancy import EmergenciaCtx

router = APIRouter(prefix="/emergencias", tags=["direccion"])

Ver = Annotated[CecoviUsuarioTemporal, Depends(require_perm("direccion:ver"))]
Operar = Annotated[CecoviUsuarioTemporal, Depends(require_perm("direccion:operar", write=True))]
P = "/{id_emergencia}/direccion"


# --- grupos ---
@router.get(f"{P}/grupos", response_model=list[GrupoRead])
async def list_grupos(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[GrupoRead]:
    rows = await OperativoRepo(db).list_for(CecoviDirGrupo, emergencia.id)
    return [GrupoRead.model_validate(r) for r in rows]


@router.post(f"{P}/grupos", response_model=GrupoRead, status_code=status.HTTP_201_CREATED)
async def crear_grupo(
    emergencia: EmergenciaCtx, principal: Operar, payload: GrupoCreate, db: DbSession
) -> GrupoRead:
    row = CecoviDirGrupo(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:grupo_creado",
        payload={"id": row.id, "tipo": row.tipo},
    )
    await db.commit()
    return GrupoRead.model_validate(row)


@router.post(f"{P}/grupos/{{gid}}/estado", response_model=GrupoRead)
async def estado_grupo(
    emergencia: EmergenciaCtx, principal: Operar, gid: int, payload: EstadoUpdate, db: DbSession
) -> GrupoRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirGrupo, emergencia.id, gid)
    if row is None:
        raise NotFoundError("Grupo no encontrado", code="grupo_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:grupo_estado",
        payload={"id": gid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return GrupoRead.model_validate(row)


# --- solicitudes de medios ---
@router.get(f"{P}/solicitudes", response_model=list[SolicitudMediosRead])
async def list_solicitudes(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[SolicitudMediosRead]:
    rows = await OperativoRepo(db).list_for(CecoviDirSolicitudMedios, emergencia.id)
    return [SolicitudMediosRead.model_validate(r) for r in rows]


@router.post(
    f"{P}/solicitudes", response_model=SolicitudMediosRead, status_code=status.HTTP_201_CREATED
)
async def crear_solicitud(
    emergencia: EmergenciaCtx, principal: Operar, payload: SolicitudMediosCreate, db: DbSession
) -> SolicitudMediosRead:
    row = CecoviDirSolicitudMedios(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:solicitud_creada",
        payload={"id": row.id},
    )
    await db.commit()
    return SolicitudMediosRead.model_validate(row)


@router.post(f"{P}/solicitudes/{{sid}}/decidir", response_model=SolicitudMediosRead)
async def decidir_solicitud(
    emergencia: EmergenciaCtx, principal: Operar, sid: int, payload: EstadoUpdate, db: DbSession
) -> SolicitudMediosRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirSolicitudMedios, emergencia.id, sid)
    if row is None:
        raise NotFoundError("Solicitud no encontrada", code="solicitud_not_found")
    row.estado = payload.estado
    row.decided_at = datetime.now(UTC)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:solicitud_decidida",
        payload={"id": sid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return SolicitudMediosRead.model_validate(row)


# --- comunicados ---
@router.get(f"{P}/comunicados", response_model=list[ComunicadoRead])
async def list_comunicados(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[ComunicadoRead]:
    rows = await OperativoRepo(db).list_for(CecoviDirComunicado, emergencia.id)
    return [ComunicadoRead.model_validate(r) for r in rows]


@router.post(f"{P}/comunicados", response_model=ComunicadoRead, status_code=status.HTTP_201_CREATED)
async def crear_comunicado(
    emergencia: EmergenciaCtx, principal: Operar, payload: ComunicadoCreate, db: DbSession
) -> ComunicadoRead:
    row = CecoviDirComunicado(
        emergencia_id=emergencia.id, created_by=principal.nombre, **payload.model_dump()
    )
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:comunicado_creado",
        payload={"id": row.id},
    )
    await db.commit()
    return ComunicadoRead.model_validate(row)


@router.post(f"{P}/comunicados/{{cid}}/estado", response_model=ComunicadoRead)
async def estado_comunicado(
    emergencia: EmergenciaCtx, principal: Operar, cid: int, payload: EstadoUpdate, db: DbSession
) -> ComunicadoRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirComunicado, emergencia.id, cid)
    if row is None:
        raise NotFoundError("Comunicado no encontrado", code="comunicado_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:comunicado_estado",
        payload={"id": cid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return ComunicadoRead.model_validate(row)


# --- albergues ---
@router.get(f"{P}/albergues", response_model=list[AlbergueRead])
async def list_albergues(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[AlbergueRead]:
    rows = await OperativoRepo(db).list_for(CecoviDirAlbergue, emergencia.id)
    return [AlbergueRead.model_validate(r) for r in rows]


@router.post(f"{P}/albergues", response_model=AlbergueRead, status_code=status.HTTP_201_CREATED)
async def crear_albergue(
    emergencia: EmergenciaCtx, principal: Operar, payload: AlbergueCreate, db: DbSession
) -> AlbergueRead:
    row = CecoviDirAlbergue(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:albergue_creado",
        payload={"id": row.id, "name": row.name},
    )
    await db.commit()
    return AlbergueRead.model_validate(row)


@router.post(f"{P}/albergues/{{aid}}/ocupacion", response_model=AlbergueRead)
async def ocupacion_albergue(
    emergencia: EmergenciaCtx, principal: Operar, aid: int, payload: OcupacionUpdate, db: DbSession
) -> AlbergueRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirAlbergue, emergencia.id, aid)
    if row is None:
        raise NotFoundError("Albergue no encontrado", code="albergue_not_found")
    row.occupancy = payload.occupancy
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:albergue_ocupacion",
        payload={"id": aid, "occupancy": payload.occupancy},
    )
    await db.commit()
    await db.refresh(row)
    return AlbergueRead.model_validate(row)


# --- evacuaciones ---
@router.get(f"{P}/evacuaciones", response_model=list[EvacuacionRead])
async def list_evacuaciones(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[EvacuacionRead]:
    rows = await OperativoRepo(db).list_for(CecoviDirEvacuacion, emergencia.id)
    return [EvacuacionRead.model_validate(r) for r in rows]


@router.post(
    f"{P}/evacuaciones", response_model=EvacuacionRead, status_code=status.HTTP_201_CREATED
)
async def crear_evacuacion(
    emergencia: EmergenciaCtx, principal: Operar, payload: EvacuacionCreate, db: DbSession
) -> EvacuacionRead:
    row = CecoviDirEvacuacion(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:evacuacion_creada",
        payload={"id": row.id, "name": row.name},
    )
    await db.commit()
    return EvacuacionRead.model_validate(row)


@router.post(f"{P}/evacuaciones/{{eid}}/estado", response_model=EvacuacionRead)
async def estado_evacuacion(
    emergencia: EmergenciaCtx, principal: Operar, eid: int, payload: EstadoUpdate, db: DbSession
) -> EvacuacionRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirEvacuacion, emergencia.id, eid)
    if row is None:
        raise NotFoundError("Evacuación no encontrada", code="evacuacion_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:evacuacion_estado",
        payload={"id": eid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return EvacuacionRead.model_validate(row)


@router.post(f"{P}/evacuaciones/{{eid}}/evacuados", response_model=EvacuacionRead)
async def evacuados_evacuacion(
    emergencia: EmergenciaCtx, principal: Operar, eid: int, payload: EvacuadosUpdate, db: DbSession
) -> EvacuacionRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviDirEvacuacion, emergencia.id, eid)
    if row is None:
        raise NotFoundError("Evacuación no encontrada", code="evacuacion_not_found")
    row.evacuated_people = payload.evacuated_people
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.id,
        accion="direccion:evacuacion_evacuados",
        payload={"id": eid, "evacuated": payload.evacuated_people},
    )
    await db.commit()
    await db.refresh(row)
    return EvacuacionRead.model_validate(row)
