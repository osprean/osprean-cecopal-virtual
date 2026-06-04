"""Auditoría inmutable de la emergencia (I7).

APPEND-ONLY: solo INSERT. No hay rutas de UPDATE/DELETE sobre esta tabla y no
lleva `updated_at`. El refuerzo a nivel de DB (REVOKE UPDATE,DELETE / trigger
de solo-insert) queda para F7. Acotada por `emergencia_id` (I6).

`actor_usuario_id` es una referencia lógica al usuario temporal (nullable para
permitir acciones de sistema); sin FK ni cascada para no condicionar el
append-only.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviLog(Base):
    __tablename__ = "cecovi_log"

    id: Mapped[int] = mapped_column(primary_key=True)

    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    actor_usuario_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    accion: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
