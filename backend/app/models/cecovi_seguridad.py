"""Entidades operativas del área de SEGURIDAD.

Derivadas de los stores del front (seguridad/incidents): perímetros (polígono o
círculo), controles de acceso, cortes viales e incidencias. Toda fila lleva
`emergencia_id` (I6). La geometría se guarda plana (lat/lng) + JSON
(anillo de polígono / segmento), no PostGIS: el front renderiza y no se
necesitan queries espaciales server-side en F3. El historial de acciones va a
`cecovi_log` (I7), no a una tabla aparte.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviSegPerimetro(Base):
    __tablename__ = "cecovi_seg_perimetro"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # exclusion|evacuation|safety|buffer
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    shape: Mapped[str] = mapped_column(String(10), nullable=False)  # polygon|circle
    points: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)  # [{lat,lng}] (polygon)
    center_lat: Mapped[float | None] = mapped_column(Float)  # circle
    center_lng: Mapped[float | None] = mapped_column(Float)
    radius_m: Mapped[float | None] = mapped_column(Float)
    nivel: Mapped[int | None] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String(32))
    estado: Mapped[str] = mapped_column(
        String(12), nullable=False, server_default="active"
    )  # active|lifted
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviSegAcceso(Base):
    __tablename__ = "cecovi_seg_acceso"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(12), nullable=False)  # access|checkpoint
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(12), nullable=False, server_default="open"
    )  # open|restricted|closed
    units: Mapped[int | None] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )


class CecoviSegCorte(Base):
    __tablename__ = "cecovi_seg_corte"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    road: Mapped[str] = mapped_column(String(160), nullable=False)
    km: Mapped[str | None] = mapped_column(String(20))
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    segment: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # {from:{lat,lng}, to:{lat,lng}}
    reason: Mapped[str | None] = mapped_column(String(255))
    estado: Mapped[str] = mapped_column(
        String(14), nullable=False, server_default="active"
    )  # active|intermittent|lifted
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviSegIncidencia(Base):
    __tablename__ = "cecovi_seg_incidencia"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    tipo: Mapped[str] = mapped_column(String(24), nullable=False)  # EmergencyDomain
    severity: Mapped[str] = mapped_column(
        String(12), nullable=False
    )  # critical|high|medium|low|info
    estado: Mapped[str] = mapped_column(String(14), nullable=False, server_default="active")
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(String(2000))
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
