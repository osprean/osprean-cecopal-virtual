"""Credencial temporal de acceso a una emergencia.

Solo se almacena el hash del token, nunca el valor en claro (el claro va en el
email). Acotada por `emergencia_id` (I6). El canje/login es F2.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviCredencial(Base):
    __tablename__ = "cecovi_credencial"

    id: Mapped[int] = mapped_column(primary_key=True)

    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    usuario_temporal_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id"), nullable=False, index=True
    )

    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="emitida")
    expira_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usada_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "estado IN ('emitida','activa','revocada','expirada')",
            name="ck_cecovi_credencial_estado",
        ),
    )
