"""Cierre y reactivación de la emergencia + descarga del PDF de informe (P11).

Solo dirección puede finalizar/reactivar. El PDF se genera al finalizar y queda
descargable desde el endpoint dedicado.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.core.audit import audit
from app.core.exceptions import AppError, NotFoundError
from app.deps import DbSession
from app.rbac import require_perm
from app.schemas.emergencia import EmergenciaRead
from app.services.informe_service import generar_informe_pdf
from app.tenancy import EmergenciaCtx, SessionCtx

router = APIRouter(prefix="/emergencias", tags=["cierre"])
P = "/{id_emergencia}"


@router.post(
    f"{P}/finalizar",
    response_model=EmergenciaRead,
    summary="Finalizar la emergencia (solo dirección) — genera PDF",
)
async def finalizar(
    emergencia: EmergenciaCtx,
    principal: Annotated[SessionCtx, Depends(require_perm("direccion:operar", write=True))],
    db: DbSession,
) -> EmergenciaRead:
    if emergencia.estado == "finalizada":
        return EmergenciaRead.model_validate(emergencia)
    emergencia.estado = "finalizada"
    emergencia.finalizada_at = datetime.now(UTC)
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="emergencia_finalizada",
        payload={},
    )
    await db.flush()  # asegura que finalizada_at está visible al servicio
    try:
        await generar_informe_pdf(db, emergencia.id)
    except RuntimeError as exc:
        # WeasyPrint no disponible (entornos sin libs sistema). No bloqueamos el
        # cierre: solo dejamos `informe_pdf_path` en NULL y avisamos.
        await audit(
            db,
            emergencia_id=emergencia.id,
            actor_id=principal.usuario_id,
            accion="informe_pdf_skip",
            payload={"motivo": str(exc)},
        )
    await db.commit()
    await db.refresh(emergencia)
    return EmergenciaRead.model_validate(emergencia)


@router.post(
    f"{P}/reactivar",
    response_model=EmergenciaRead,
    summary="Reactivar una emergencia finalizada (solo dirección)",
)
async def reactivar(
    emergencia: EmergenciaCtx,
    principal: Annotated[SessionCtx, Depends(require_perm("direccion:operar", write=True))],
    db: DbSession,
) -> EmergenciaRead:
    if emergencia.estado != "finalizada":
        raise AppError(
            f"No se puede reactivar en estado '{emergencia.estado}'", code="estado_invalido"
        )
    emergencia.estado = "activa"
    emergencia.finalizada_at = None
    await audit(
        db,
        emergencia_id=emergencia.id,
        actor_id=principal.usuario_id,
        accion="emergencia_reactivada",
        payload={},
    )
    await db.commit()
    await db.refresh(emergencia)
    return EmergenciaRead.model_validate(emergencia)


@router.get(
    f"{P}/informe.pdf",
    summary="Descargar el PDF de informe (tras finalizar)",
)
async def descargar_pdf(
    emergencia: EmergenciaCtx,
    _p: Annotated[SessionCtx, Depends(require_perm("logs:ver"))],
) -> FileResponse:
    if not emergencia.informe_pdf_path:
        raise NotFoundError("No hay informe PDF para esta emergencia", code="informe_no_generado")
    p = Path(emergencia.informe_pdf_path)
    if not p.exists():
        raise NotFoundError("Archivo del informe no encontrado en disco", code="informe_missing")
    return FileResponse(
        path=str(p),
        media_type="application/pdf",
        filename=f"{emergencia.slug}-informe.pdf",
    )
