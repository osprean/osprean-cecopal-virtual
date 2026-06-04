"""Entidades operativas del área LOGÍSTICA (suministros, solicitudes, servicios).

Derivadas del logisticaStore. Las ubicaciones son texto (sin geo). Vehículos y
maquinaria son catálogos (solo lectura) → no se modelan. emergencia_id en todo (I6).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviLogiSuministro(Base):
    __tablename__ = "cecovi_logi_suministro"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(16), nullable=False)  # water|food|medical|...
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, server_default="ud")
    stock: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    min_stock: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    location: Mapped[str | None] = mapped_column(String(160))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )


class CecoviLogiSolicitud(Base):
    __tablename__ = "cecovi_logi_solicitud"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    item_name: Mapped[str] = mapped_column(String(160), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    unit: Mapped[str | None] = mapped_column(String(20))
    priority: Mapped[str] = mapped_column(String(12), nullable=False, server_default="medium")
    estado: Mapped[str] = mapped_column(String(12), nullable=False, server_default="pending")
    destination: Mapped[str | None] = mapped_column(String(160))
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CecoviLogiServicio(Base):
    __tablename__ = "cecovi_logi_servicio"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # water|electricity|gas|telecom|sewer
    area: Mapped[str] = mapped_column(String(160), nullable=False)
    estado: Mapped[str] = mapped_column(String(12), nullable=False, server_default="operational")
    affected_population: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    provider: Mapped[str | None] = mapped_column(String(120))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, onupdate=func.now()
    )
