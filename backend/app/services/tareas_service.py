"""Carga inicial de tareas operativas al crear una emergencia (P5).

Snapshot: lee del diagrama de actividades del PAMIF en COMACON (TODO). Si no hay
diagrama, genera placeholders por rol — las acciones del minuto cero más comunes.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_tarea import CecoviTarea

# Plantillas placeholder por rol (las del minuto cero). Reuniones piden que la
# fuente real sea el diagrama de actividades del PAMIF de COMACON; mientras se
# integra eso, esto cubre la operación inicial de cualquier emergencia.
PLACEHOLDERS: dict[str, list[tuple[str, str, str]]] = {
    "direccion": [
        ("DIR-1", "Confirmar la emergencia", "Validar tipo, gravedad y nivel operativo."),
        (
            "DIR-2",
            "Notificar al CECOPAL",
            "Convocar al puesto de mando y a los responsables de área.",
        ),
        (
            "DIR-3",
            "Decidir nivel operativo",
            "Fijar el nivel (0/1/2/3) y comunicar a todas las áreas.",
        ),
    ],
    "logistica": [
        ("LOG-1", "Inventariar recursos disponibles", "Revisar suministros y vehículos en ruta."),
        ("LOG-2", "Asegurar canal de aprovisionamiento", "Contactar con proveedores críticos."),
    ],
    "sanitario": [
        ("SAN-1", "Activar puesto sanitario", "Definir ubicación PMA y zonas de triage."),
        ("SAN-2", "Alertar hospitales de referencia", "Comunicar volumen esperado de heridos."),
    ],
    "seguridad": [
        (
            "SEG-1",
            "Establecer perímetro de seguridad",
            "Marcar zona de exclusión y accesos controlados.",
        ),
        ("SEG-2", "Coordinar tráfico", "Definir cortes viales y rutas de evacuación."),
    ],
    "gabinete": [
        ("GAB-1", "Preparar primer comunicado", "Mensaje breve a población y prensa."),
        ("GAB-2", "Abrir canales de comunicación", "Redes sociales y teléfono ciudadano."),
    ],
}


async def crear_tareas_iniciales(db: AsyncSession, *, emergencia_id: int) -> int:
    """Crea las tareas placeholder por rol. Devuelve nº de tareas creadas."""
    n = 0
    for rol, items in PLACEHOLDERS.items():
        for orden, (codigo, titulo, descripcion) in enumerate(items, start=1):
            db.add(
                CecoviTarea(
                    emergencia_id=emergencia_id,
                    rol=rol,
                    codigo=codigo,
                    titulo=titulo,
                    descripcion=descripcion,
                    orden=orden,
                )
            )
            n += 1
    await db.flush()
    return n
