"""Pipeline endpoint — vista en vivo del estado de una emergencia/simulacro.

El FE de COMACON (página /simulacro) hace polling de este endpoint vía un proxy
COMACON (X-Webhook-Secret) cada 2s para pintar el avance: emergencia creada,
credenciales emitidas, sesiones abiertas, tareas en marcha, finalización.

Acceso: bearer secret en `X-Webhook-Secret`. No es API pública del operador
CECOVI; es canal entre COMACON y CECOVI.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Header, HTTPException, status
from sqlalchemy import func, select

from app.config import settings
from app.deps import DbSession
from app.models.cecovi_credencial import CecoviCredencial
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_sesion import CecoviSesion
from app.models.cecovi_tarea import CecoviTarea
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def _check_secret(x_webhook_secret: str | None) -> None:
    # COMACON firma sus llamadas a CECOVI con este secret (mismo valor en ambos
    # lados); el FE de COMACON nunca llama a este endpoint directamente.
    secret = getattr(settings, "COMACON_WEBHOOK_SECRET", None)
    if not secret:
        return  # permisivo en dev
    if x_webhook_secret != secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="webhook_secret_invalid"
        )


def _etapa(label: str, key: str, at: datetime | None) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "completed": at is not None,
        "at": at.isoformat() if at else None,
    }


@router.get("/{slug}")
async def pipeline_state(
    slug: str,
    db: DbSession,
    x_webhook_secret: str | None = Header(default=None),
):
    _check_secret(x_webhook_secret)

    em = (
        await db.execute(select(CecoviEmergencia).where(CecoviEmergencia.slug == slug))
    ).scalar_one_or_none()
    if em is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="emergencia_no_existe"
        )

    creds = (
        (await db.execute(
            select(CecoviCredencial).where(CecoviCredencial.emergencia_id == em.id)
        ))
        .scalars()
        .all()
    )
    sesiones = (
        (await db.execute(
            select(CecoviSesion)
            .join(CecoviCredencial, CecoviCredencial.id == CecoviSesion.credencial_id)
            .where(CecoviCredencial.emergencia_id == em.id)
        ))
        .scalars()
        .all()
    )

    usuario_ids = [c.usuario_temporal_id for c in creds if c.usuario_temporal_id is not None]
    emails: dict[int, str] = {}
    if usuario_ids:
        rows = (await db.execute(
            select(CecoviUsuarioTemporal.id, CecoviUsuarioTemporal.email).where(
                CecoviUsuarioTemporal.id.in_(usuario_ids)
            )
        )).all()
        emails = {r[0]: r[1] for r in rows}

    tareas_rows = (await db.execute(
        select(CecoviTarea.rol, CecoviTarea.estado, func.count().label("n"))
        .where(CecoviTarea.emergencia_id == em.id)
        .group_by(CecoviTarea.rol, CecoviTarea.estado)
    )).all()
    tareas_by_rol: dict[str, dict[str, int]] = {}
    for rol, estado, n in tareas_rows:
        tareas_by_rol.setdefault(
            rol, {"pending": 0, "accepted": 0, "completed": 0, "cancelled": 0}
        )
        tareas_by_rol[rol][estado] = int(n)
    tareas_out = [
        {
            "rol": rol,
            "pendientes": vs.get("pending", 0),
            "aceptadas": vs.get("accepted", 0),
            "completadas": vs.get("completed", 0),
        }
        for rol, vs in sorted(tareas_by_rol.items())
    ]

    primera_sesion_at = (
        min((ses.started_at for ses in sesiones), default=None) if sesiones else None
    )
    primera_tarea_aceptada = (await db.execute(
        select(func.min(CecoviTarea.accepted_at)).where(
            CecoviTarea.emergencia_id == em.id,
            CecoviTarea.accepted_at.is_not(None),
        )
    )).scalar()

    etapas = [
        _etapa("Emergencia creada", "creada", em.created_at),
        _etapa("Credenciales emitidas", "credenciales", em.created_at if creds else None),
        _etapa("Usuarios conectados", "sesiones", primera_sesion_at),
        _etapa("Tareas en marcha", "tareas", primera_tarea_aceptada),
        _etapa("Finalizada", "finalizada", em.finalizada_at),
    ]

    return {
        "slug": em.slug,
        "estado": em.estado,
        "modo": em.modo,
        "created_at": em.created_at.isoformat(),
        "finalizada_at": em.finalizada_at.isoformat() if em.finalizada_at else None,
        "etapas": etapas,
        "credenciales": [
            {
                "id": c.id,
                "tipo": c.tipo,
                "roles": c.roles_list(),
                "destinatarios": (
                    [emails[c.usuario_temporal_id]]
                    if c.usuario_temporal_id and c.usuario_temporal_id in emails
                    else []
                ),
                "estado": c.estado,
                "activa": c.estado in ("emitida", "activa"),
            }
            for c in creds
        ],
        "sesiones": [
            {
                "credencial_id": ses.credencial_id,
                "usuario_email": emails.get(ses.usuario_temporal_id)
                if ses.usuario_temporal_id
                else None,
                "tipo": next((c.tipo for c in creds if c.id == ses.credencial_id), "?"),
                "roles": next(
                    (c.roles_list() for c in creds if c.id == ses.credencial_id), []
                ),
                "started_at": ses.started_at.isoformat(),
                "last_seen_at": ses.last_seen_at.isoformat(),
            }
            for ses in sesiones
            if ses.ended_at is None
        ],
        "tareas": tareas_out,
        "log_count": 0,
    }
