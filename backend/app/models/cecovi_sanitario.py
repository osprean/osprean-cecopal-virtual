"""Entidades operativas del área SANITARIO (víctimas/triaje, zonas, alertas).

Derivadas del sanitarioStore. Toda fila lleva `emergencia_id` (I6). Ambulancias
y hospitales son catálogos (solo lectura en el front) → no se modelan aquí.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviSanVictima(Base):
    __tablename__ = "cecovi_san_victima"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    triage: Mapped[str] = mapped_column(String(8), nullable=False, server_default="unset")
    estado: Mapped[str] = mapped_column(String(16), nullable=False, server_default="on-scene")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(String(1000))
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviSanZona(Base):
    __tablename__ = "cecovi_san_zona"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # triage-point|first-aid|morgue|...
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    current: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estado: Mapped[str] = mapped_column(String(16), nullable=False, server_default="operational")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviSanAlerta(Base):
    __tablename__ = "cecovi_san_alerta"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    severity: Mapped[str] = mapped_column(String(12), nullable=False, server_default="medium")
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
