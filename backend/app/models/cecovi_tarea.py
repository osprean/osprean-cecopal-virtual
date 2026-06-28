"""Tareas operativas (snapshot del diagrama de actividades del PAMIF).

Cada emergencia nace con un set de tareas POR ROL, importadas del diagrama de
actividades de COMACON (P5). Si COMACON no tiene diagrama, se generan
PLACEHOLDERS por rol (las del minuto cero). Visibles solo al rol propietario;
el jefe (dirección) las ve todas.

Estados: pending → accepted → completed (o cancelled). Cada transición se
audita en `cecovi_log` (I7).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviTarea(Base):
    __tablename__ = "cecovi_tarea"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    rol: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    codigo: Mapped[str | None] = mapped_column(String(40))  # T-DIR-1, etc.
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estado: Mapped[str] = mapped_column(String(14), nullable=False, server_default="pending")
    # Si se generó desde el diagrama de actividades de COMACON, este es el id
    # del nodo origen. NULL si es placeholder o creada manualmente.
    comacon_activity_id: Mapped[int | None] = mapped_column(Integer)
    accepted_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id")
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "estado IN ('pending','accepted','completed','cancelled')",
            name="ck_cecovi_tarea_estado",
        ),
    )
