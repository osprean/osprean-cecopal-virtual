"""Sesión activa de una credencial (P3: sesión única por credencial).

Cada login abre una sesión con un `jti` (UUID) que también va en el JWT. Cada
request del cliente actualiza `last_seen_at`. El logout fija `ended_at`.

Invariante: como máximo una sesión activa por credencial (índice único parcial).
Si entra una segunda sesión con la misma credencial → 409, salvo `force=true` que
cierra la anterior.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviSesion(Base):
    __tablename__ = "cecovi_sesion"

    id: Mapped[int] = mapped_column(primary_key=True)
    credencial_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_credencial.id"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    # Usuario temporal que abrió la sesión (para backup compartida, se nomina al
    # primer login).
    usuario_temporal_id: Mapped[int | None] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id"), nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_reason: Mapped[str | None] = mapped_column(String(40))  # logout|forced|expired|master_in

    __table_args__ = (
        # Una sola sesión activa por credencial (Postgres partial index; sqlite_where
        # para que el invariante se ejerza también en tests SQLite).
        Index(
            "uq_cecovi_sesion_activa",
            "credencial_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
    )
