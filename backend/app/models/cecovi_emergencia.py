"""Entidad raíz de tenancy: la emergencia en curso.

Es la raíz multi-tenant de CECOVI: toda fila operativa se acota por su `id`
(las tablas hijas vía `emergencia_id`). Referencia a COMACON (`organization`,
`emergencies`) por id SIN poseer esas tablas: la FK real se crea en la
migración (no hay objeto SQLAlchemy ForeignKey aquí, porque las tablas de
COMACON no viven en este `MetaData`). Ver skills `comacon-db-access` y
`db-migration`.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Conjuntos cerrados (controles de integridad vía CHECK en la migración y aquí).
ESTADOS = ("activa", "finalizada", "cerrada", "archivada")
MODOS = ("real", "simulacro")
NIVELES = ("cecopal", "pma")


class CecoviEmergencia(Base):
    __tablename__ = "cecovi_emergencia"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Referencias a COMACON (lógicas; FK real en la migración, sin cascada).
    organization_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    comacon_emergency_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Identificador de ruta /{idEmergencia}.
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="activa")
    modo: Mapped[str] = mapped_column(String(20), nullable=False)
    nivel: Mapped[str] = mapped_column(String(20), nullable=False, server_default="cecopal")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finalizada_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lectura_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archivada_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint(
            "estado IN ('activa','finalizada','cerrada','archivada')",
            name="ck_cecovi_emergencia_estado",
        ),
        CheckConstraint("modo IN ('real','simulacro')", name="ck_cecovi_emergencia_modo"),
        CheckConstraint("nivel IN ('cecopal','pma')", name="ck_cecovi_emergencia_nivel"),
    )
