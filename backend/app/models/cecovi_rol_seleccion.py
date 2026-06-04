"""Selección de rol de un usuario temporal en una emergencia.

`rol` es un STRING (no enum de DB): el conjunto de roles es extensible.
La selección, una vez confirmada, es inmutable (I4).

I1 — MANDO ÚNICO a nivel de datos: índice único PARCIAL que garantiza, como
máximo, un rol 'jefe' activo por emergencia. No depende de validación en
servicio. Se declara aquí (con `sqlite_where` para que también aplique en los
tests sobre SQLite) y se repite explícitamente en la migración para Postgres.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviRolSeleccion(Base):
    __tablename__ = "cecovi_rol_seleccion"

    id: Mapped[int] = mapped_column(primary_key=True)

    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    usuario_temporal_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id"), nullable=False, index=True
    )

    rol: Mapped[str] = mapped_column(String(40), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    confirmada_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index(
            "uq_cecovi_jefe_activo",
            "emergencia_id",
            unique=True,
            postgresql_where=text("rol = 'jefe' AND activo"),
            sqlite_where=text("rol = 'jefe' AND activo"),
        ),
    )
