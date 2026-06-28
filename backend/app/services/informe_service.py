"""Generación de PDF de informe al cierre de la emergencia (P11).

Recoge el estado agregado de la emergencia (balance operativo, víctimas, cortes,
duración, log) y produce un PDF con WeasyPrint a partir de una plantilla HTML.
El PDF se guarda en local (`./var/informes/<slug>.pdf`) o en S3 si está
configurado (decisión D6 — bucket `cecovi-informes-{env}` provisionado por
DevOps en runbook).

Estilo: plantilla genérica ahora; cuando llegue el PDF de Javi como referencia,
se afina el CSS sin cambiar la API.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, PackageLoader, select_autoescape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_direccion import CecoviDirEvacuacion
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_log import CecoviLog
from app.models.cecovi_sanitario import CecoviSanVictima
from app.models.cecovi_seguridad import CecoviSegCorte
from app.models.cecovi_tarea import CecoviTarea

log = logging.getLogger(__name__)

_env = Environment(
    loader=PackageLoader("app", "templates"),
    autoescape=select_autoescape(["html", "xml"]),
)


def _local_pdf_path(slug: str) -> Path:
    base = Path("./var/informes")
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{slug}-informe.pdf"


async def _agregados(db: AsyncSession, em: CecoviEmergencia) -> dict[str, object]:
    """Calcula los números agregados del informe."""
    # Víctimas
    stmt_vic = select(CecoviSanVictima.estado, func.count(CecoviSanVictima.id)).where(
        CecoviSanVictima.emergencia_id == em.id
    ).group_by(CecoviSanVictima.estado)
    victimas_por_estado: dict[str, int] = {
        row[0]: row[1] for row in (await db.execute(stmt_vic)).all()
    }

    # Cortes viales
    stmt_cor = select(func.count(CecoviSegCorte.id)).where(
        CecoviSegCorte.emergencia_id == em.id
    )
    cortes = (await db.execute(stmt_cor)).scalar() or 0

    # Evacuados (sum)
    stmt_ev = select(func.coalesce(func.sum(CecoviDirEvacuacion.evacuated_people), 0)).where(
        CecoviDirEvacuacion.emergencia_id == em.id
    )
    evacuados = (await db.execute(stmt_ev)).scalar() or 0

    # Tareas
    stmt_tar = select(CecoviTarea.estado, func.count(CecoviTarea.id)).where(
        CecoviTarea.emergencia_id == em.id
    ).group_by(CecoviTarea.estado)
    tareas_por_estado: dict[str, int] = {
        row[0]: row[1] for row in (await db.execute(stmt_tar)).all()
    }

    # Log
    stmt_log = (
        select(CecoviLog)
        .where(CecoviLog.emergencia_id == em.id)
        .order_by(CecoviLog.at.asc())
    )
    logs = (await db.execute(stmt_log)).scalars().all()

    duracion_min: int | None = None
    if em.finalizada_at and em.created_at:
        ini = em.created_at.replace(tzinfo=UTC) if em.created_at.tzinfo is None else em.created_at
        fin = (
            em.finalizada_at.replace(tzinfo=UTC)
            if em.finalizada_at.tzinfo is None
            else em.finalizada_at
        )
        duracion_min = int((fin - ini).total_seconds() // 60)

    return {
        "emergencia": em,
        "victimas_por_estado": victimas_por_estado,
        "victimas_total": sum(victimas_por_estado.values()),
        "cortes_total": cortes,
        "evacuados_total": evacuados,
        "tareas_por_estado": tareas_por_estado,
        "tareas_total": sum(tareas_por_estado.values()),
        "logs": logs,
        "duracion_min": duracion_min,
        "generated_at": datetime.now(UTC),
    }


async def generar_informe_pdf(db: AsyncSession, emergencia_id: int) -> str:
    """Devuelve la ruta local (o key S3) del PDF generado.

    Importa WeasyPrint en runtime para evitar coste de import si no se usa.
    """
    em = await db.get(CecoviEmergencia, emergencia_id)
    if em is None:
        raise ValueError("Emergencia no existe")
    ctx = await _agregados(db, em)
    template = _env.get_template("informe_emergencia.html")
    html_str = template.render(**ctx)

    try:
        from weasyprint import HTML  # type: ignore[import-untyped]
    except ImportError as exc:
        log.error("WeasyPrint no disponible: %s", exc)
        raise RuntimeError(
            "WeasyPrint no instalado en el entorno; instalar `weasyprint` y libs"
            " de sistema (cairo, pango)."
        ) from exc

    out = _local_pdf_path(em.slug)
    HTML(string=html_str).write_pdf(target=str(out))
    em.informe_pdf_path = str(out)
    await db.flush()
    return str(out)
