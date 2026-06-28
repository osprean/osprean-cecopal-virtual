"""Tareas operativas por rol (P5).

RBAC: cada rol ve solo sus tareas; dirección ve todas (porque tiene todos los
permisos por `direccion`). Transiciones de estado: pending → accepted → completed
(o cancelled). Cada transición se audita.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.core.audit import audit
from app.core.exceptions import AppError, ForbiddenError, NotFoundError
from app.deps import DbSession
from app.models.cecovi_tarea import CecoviTarea
from app.rbac import require_perm
from app.schemas.tareas import TareaRead
from app.tenancy import EmergenciaCtx, SessionCtx, SessionDep

router = APIRouter(prefix="/emergencias", tags=["tareas"])
P = "/{id_emergencia}/tareas"


class EstadoUpdate(BaseModel):
    estado: Literal["accepted", "completed", "cancelled"]


def _puede_ver_rol(session: SessionCtx, rol: str) -> bool:
    """`direccion` ve todo; el resto solo su rol."""
    if "direccion" in session.roles:
        return True
    return rol in session.roles


@router.get(P, response_model=list[TareaRead], summary="Listar tareas del usuario")
async def list_tareas(
    emergencia: EmergenciaCtx, session: SessionDep, db: DbSession
) -> list[TareaRead]:
    """Devuelve las tareas visibles para la sesión actual.

    - direccion → ve todas
    - otros roles → ven solo las suyas
    """
    stmt = select(CecoviTarea).where(CecoviTarea.emergencia_id == emergencia.id)
    if "direccion" not in session.roles:
        stmt = stmt.where(CecoviTarea.rol.in_(session.roles))
    stmt = stmt.order_by(CecoviTarea.rol.asc(), CecoviTarea.orden.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return [TareaRead.model_validate(r) for r in rows]


@router.post(
    f"{P}/{{tid}}/aceptar",
    response_model=TareaRead,
    summary="Aceptar una tarea (estado=accepted)",
)
async def aceptar_tarea(
    emergencia: EmergenciaCtx, session: SessionDep, tid: int, db: DbSession
) -> TareaRead:
    tarea = await _get_tarea(db, emergencia.id, tid)
    if not _puede_ver_rol(session, tarea.rol):
        raise ForbiddenError("No puedes aceptar tareas de otro rol", code="forbidden_perm")
    if tarea.estado not in ("pending", "accepted"):
        raise AppError(
            f"No se puede aceptar una tarea en estado '{tarea.estado}'", code="estado_invalido"
        )
    if session.usuario_id is None:
        raise AppError("Sesión sin usuario nominado", code="sesion_sin_usuario")
    tarea.estado = "accepted"
    tarea.accepted_by_id = session.usuario_id
    tarea.accepted_at = datetime.now(UTC)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=session.usuario_id,
        accion="tarea:aceptada",
        payload={"id": tid, "rol": tarea.rol},
    )
    await db.commit()
    await db.refresh(tarea)
    return TareaRead.model_validate(tarea)


@router.post(
    f"{P}/{{tid}}/completar",
    response_model=TareaRead,
    summary="Completar una tarea (estado=completed)",
)
async def completar_tarea(
    emergencia: EmergenciaCtx, session: SessionDep, tid: int, db: DbSession
) -> TareaRead:
    tarea = await _get_tarea(db, emergencia.id, tid)
    if not _puede_ver_rol(session, tarea.rol):
        raise ForbiddenError("No puedes completar tareas de otro rol", code="forbidden_perm")
    if tarea.estado == "cancelled":
        raise AppError("Tarea cancelada; no se puede completar", code="estado_invalido")
    tarea.estado = "completed"
    tarea.completed_at = datetime.now(UTC)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=session.usuario_id,
        accion="tarea:completada",
        payload={"id": tid, "rol": tarea.rol},
    )
    await db.commit()
    await db.refresh(tarea)
    return TareaRead.model_validate(tarea)


@router.post(
    f"{P}/{{tid}}/cancelar",
    response_model=TareaRead,
    summary="Cancelar una tarea (solo dirección)",
)
async def cancelar_tarea(
    emergencia: EmergenciaCtx,
    _p: Annotated[SessionCtx, Depends(require_perm("direccion:operar", write=True))],
    tid: int,
    db: DbSession,
) -> TareaRead:
    tarea = await _get_tarea(db, emergencia.id, tid)
    tarea.estado = "cancelled"
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=_p.usuario_id,
        accion="tarea:cancelada",
        payload={"id": tid, "rol": tarea.rol},
    )
    await db.commit()
    await db.refresh(tarea)
    return TareaRead.model_validate(tarea)


async def _get_tarea(db: DbSession, emergencia_id: int, tid: int) -> CecoviTarea:
    tarea: CecoviTarea | None = await db.get(CecoviTarea, tid)
    if tarea is None or tarea.emergencia_id != emergencia_id:
        raise NotFoundError("Tarea no encontrada", code="tarea_not_found")
    return tarea
