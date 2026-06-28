"""Notificaciones cross-area (P9).

- POST /notificaciones (solo dirección): enviar a un rol concreto.
- GET /notificaciones?since=...: lista del rol del solicitante (o todas si dirección).
- POST /notificaciones/{id}/leida: marca como leída.

El front polea cada 30s con `since=last_known_created_at`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.core.audit import audit
from app.core.exceptions import ForbiddenError, NotFoundError
from app.deps import DbSession
from app.models.cecovi_notificacion import CecoviNotificacion
from app.rbac import require_perm
from app.tenancy import EmergenciaCtx, SessionCtx, SessionDep

router = APIRouter(prefix="/emergencias", tags=["notificaciones"])
P = "/{id_emergencia}/notificaciones"


class NotificacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    rol_destino: str
    actor_id: int | None
    tipo: str
    mensaje: str
    payload: dict[str, Any]
    leida_at: datetime | None
    created_at: datetime


class NotificacionCreate(BaseModel):
    rol_destino: str = Field(min_length=1, max_length=40)
    tipo: str = Field(min_length=1, max_length=40)
    mensaje: str = Field(min_length=1, max_length=4000)
    payload: dict[str, Any] = Field(default_factory=dict)


@router.post(
    P,
    response_model=NotificacionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Enviar notificación a un rol (solo dirección)",
)
async def crear(
    emergencia: EmergenciaCtx,
    principal: Annotated[SessionCtx, Depends(require_perm("direccion:operar", write=True))],
    payload: NotificacionCreate,
    db: DbSession,
) -> NotificacionRead:
    row = CecoviNotificacion(
        emergencia_id=emergencia.id,
        rol_destino=payload.rol_destino,
        actor_id=principal.usuario_id,
        tipo=payload.tipo,
        mensaje=payload.mensaje,
        payload=payload.payload,
    )
    db.add(row)
    await db.flush()
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="notificacion:enviada",
        payload={"id": row.id, "rol_destino": row.rol_destino, "tipo": row.tipo},
    )
    await db.commit()
    await db.refresh(row)
    return NotificacionRead.model_validate(row)


@router.get(
    P,
    response_model=list[NotificacionRead],
    summary="Notificaciones del rol del solicitante (polling 30s)",
)
async def list_notificaciones(
    emergencia: EmergenciaCtx,
    session: SessionDep,
    db: DbSession,
    since: Annotated[datetime | None, Query()] = None,
    only_unread: Annotated[bool, Query()] = False,
) -> list[NotificacionRead]:
    stmt = select(CecoviNotificacion).where(CecoviNotificacion.emergencia_id == emergencia.id)
    if "direccion" not in session.roles:
        stmt = stmt.where(CecoviNotificacion.rol_destino.in_(session.roles))
    if since is not None:
        stmt = stmt.where(CecoviNotificacion.created_at > since)
    if only_unread:
        stmt = stmt.where(CecoviNotificacion.leida_at.is_(None))
    stmt = stmt.order_by(CecoviNotificacion.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [NotificacionRead.model_validate(r) for r in rows]


@router.post(
    f"{P}/{{nid}}/leida",
    response_model=NotificacionRead,
    summary="Marcar notificación como leída",
)
async def marcar_leida(
    emergencia: EmergenciaCtx,
    session: SessionDep,
    nid: int,
    db: DbSession,
) -> NotificacionRead:
    row = await db.get(CecoviNotificacion, nid)
    if row is None or row.emergencia_id != emergencia.id:
        raise NotFoundError("Notificación no encontrada", code="notif_not_found")
    # Solo el rol destinatario (o dirección) puede marcar como leída.
    if "direccion" not in session.roles and row.rol_destino not in session.roles:
        raise ForbiddenError("Permiso insuficiente", code="forbidden_perm")
    if row.leida_at is None:
        row.leida_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(row)
    return NotificacionRead.model_validate(row)
