"""Entidades operativas del área CAMPO (puesto avanzado): tareas y reportes.

Derivadas del campoStore. La unidad de campo (FieldUnit, singleton del
dispositivo) no se modela aquí. emergencia_id en todo (I6).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviCampoTarea(Base):
    __tablename__ = "cecovi_campo_tarea"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    priority: Mapped[str] = mapped_column(String(12), nullable=False, server_default="medium")
    estado: Mapped[str] = mapped_column(String(14), nullable=False, server_default="incoming")
    assigned_to: Mapped[str | None] = mapped_column(String(60))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )


class CecoviCampoReporte(Base):
    __tablename__ = "cecovi_campo_reporte"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(12), nullable=False
    )  # incident|voice|image|checkpoint|support
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str | None] = mapped_column(String(4000))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    transcribed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())
    created_by: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
