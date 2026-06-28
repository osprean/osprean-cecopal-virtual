"""Notificaciones cross-area (P9).

Cuando dirección modifica algo de otra área, se emite una notificación al rol
destinatario. El front polea cada 30s con `?since=ts`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class CecoviNotificacion(Base):
    __tablename__ = "cecovi_notificacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    rol_destino: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id")
    )
    tipo: Mapped[str] = mapped_column(String(40), nullable=False)
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"), nullable=False, server_default="{}"
    )
    leida_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
