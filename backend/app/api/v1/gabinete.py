"""Operación del área GABINETE. RBAC gabinete:ver|operar; I7/I3/I6."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.audit import audit
from app.core.exceptions import NotFoundError
from app.deps import DbSession
from app.models.cecovi_gabinete import CecoviGabCanal, CecoviGabPublicacion
from app.rbac import require_perm
from app.repositories.operativo_repository import OperativoRepo
from app.schemas.gabinete import (
    CanalCreate,
    CanalRead,
    EstadoUpdate,
    PublicacionCreate,
    PublicacionRead,
)
from app.tenancy import EmergenciaCtx, SessionCtx

router = APIRouter(prefix="/emergencias", tags=["gabinete"])

Ver = Annotated[SessionCtx, Depends(require_perm("gabinete:ver"))]
Operar = Annotated[SessionCtx, Depends(require_perm("gabinete:operar", write=True))]
P = "/{id_emergencia}/gabinete"


# --- canales ---
@router.get(f"{P}/canales", response_model=list[CanalRead])
async def list_canales(emergencia: EmergenciaCtx, _p: Ver, db: DbSession) -> list[CanalRead]:
    rows = await OperativoRepo(db).list_for(CecoviGabCanal, emergencia.id)
    return [CanalRead.model_validate(r) for r in rows]


@router.post(f"{P}/canales", response_model=CanalRead, status_code=status.HTTP_201_CREATED)
async def crear_canal(
    emergencia: EmergenciaCtx, principal: Operar, payload: CanalCreate, db: DbSession
) -> CanalRead:
    row = CecoviGabCanal(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="gabinete:canal_creado",
        payload={"id": row.id, "kind": row.kind},
    )
    await db.commit()
    return CanalRead.model_validate(row)


@router.post(f"{P}/canales/{{cid}}/estado", response_model=CanalRead)
async def estado_canal(
    emergencia: EmergenciaCtx, principal: Operar, cid: int, payload: EstadoUpdate, db: DbSession
) -> CanalRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviGabCanal, emergencia.id, cid)
    if row is None:
        raise NotFoundError("Canal no encontrado", code="canal_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="gabinete:canal_estado",
        payload={"id": cid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return CanalRead.model_validate(row)


# --- publicaciones ---
@router.get(f"{P}/publicaciones", response_model=list[PublicacionRead])
async def list_publicaciones(
    emergencia: EmergenciaCtx, _p: Ver, db: DbSession
) -> list[PublicacionRead]:
    rows = await OperativoRepo(db).list_for(CecoviGabPublicacion, emergencia.id)
    return [PublicacionRead.model_validate(r) for r in rows]


@router.post(
    f"{P}/publicaciones", response_model=PublicacionRead, status_code=status.HTTP_201_CREATED
)
async def crear_publicacion(
    emergencia: EmergenciaCtx, principal: Operar, payload: PublicacionCreate, db: DbSession
) -> PublicacionRead:
    row = CecoviGabPublicacion(emergencia_id=emergencia.id, **payload.model_dump())
    await OperativoRepo(db).add(row)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="gabinete:publicacion_creada",
        payload={"id": row.id},
    )
    await db.commit()
    return PublicacionRead.model_validate(row)


@router.post(f"{P}/publicaciones/{{pid}}/estado", response_model=PublicacionRead)
async def estado_publicacion(
    emergencia: EmergenciaCtx, principal: Operar, pid: int, payload: EstadoUpdate, db: DbSession
) -> PublicacionRead:
    repo = OperativoRepo(db)
    row = await repo.get_for(CecoviGabPublicacion, emergencia.id, pid)
    if row is None:
        raise NotFoundError("Publicación no encontrada", code="publicacion_not_found")
    row.estado = payload.estado
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="gabinete:publicacion_estado",
        payload={"id": pid, "estado": payload.estado},
    )
    await db.commit()
    await db.refresh(row)
    return PublicacionRead.model_validate(row)
