"""Entidades operativas del área de DIRECCIÓN (vista del jefe).

Derivadas del direccionStore: grupos funcionales, solicitudes de medios,
comunicados y albergues. Toda fila lleva `emergencia_id` (I6).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviDirGrupo(Base):
    __tablename__ = "cecovi_dir_grupo"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    tipo: Mapped[str] = mapped_column(String(24), nullable=False)  # command|intervention|...
    estado: Mapped[str] = mapped_column(String(16), nullable=False, server_default="operational")
    members_total: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    members_active: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    leader: Mapped[str | None] = mapped_column(String(120))
    channel: Mapped[str | None] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )


class CecoviDirSolicitudMedios(Base):
    __tablename__ = "cecovi_dir_solicitud_medios"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    requested_by: Mapped[str] = mapped_column(String(120), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    reason: Mapped[str | None] = mapped_column(String(500))
    priority: Mapped[str] = mapped_column(String(12), nullable=False, server_default="medium")
    estado: Mapped[str] = mapped_column(String(12), nullable=False, server_default="pending")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CecoviDirComunicado(Base):
    __tablename__ = "cecovi_dir_comunicado"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(4000), nullable=False)
    audience: Mapped[str] = mapped_column(String(16), nullable=False, server_default="internal")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="draft")
    created_by: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviDirAlbergue(Base):
    __tablename__ = "cecovi_dir_albergue"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    occupancy: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estado: Mapped[str] = mapped_column(String(16), nullable=False, server_default="operational")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviDirEvacuacion(Base):
    __tablename__ = "cecovi_dir_evacuacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    estado: Mapped[str] = mapped_column(String(14), nullable=False, server_default="planned")
    # Albergue destino (FK real intra-CECOVI; sin cascada, el cierre archiva por estado).
    albergue_id: Mapped[int | None] = mapped_column(ForeignKey("cecovi_dir_albergue.id"))
    estimated_people: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    evacuated_people: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    route_points: Mapped[list[Any] | None] = mapped_column(JSON)  # [{lat,lng}] (ruta)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
