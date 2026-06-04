"""Usuario temporal de una emergencia (identidad propia de CECOVI).

No es un `usuario` de COMACON: las credenciales temporales se modelan aquí.
Toda fila se acota por `emergencia_id` (I6).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviUsuarioTemporal(Base):
    __tablename__ = "cecovi_usuario_temporal"

    id: Mapped[int] = mapped_column(primary_key=True)

    # FK intra-CECOVI: sin cascada destructiva (el cierre archiva por estado, I8).
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )

    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    # Sale del nodo CECOPAL → human_resource.phone_number en COMACON. Sin normalizar
    # (E.164 cuando se monte SMS/cámara). Ver docs de integración en comacon_web_backend.
    telefono: Mapped[str | None] = mapped_column(String(32), nullable=True)
    nivel: Mapped[str] = mapped_column(String(20), nullable=False, server_default="cecopal")

    # Degradación a solo lectura tras transferir el mando (I3; se usa en F4).
    solo_lectura: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # La selección de roles, una vez confirmada, es inmutable (I4).
    roles_confirmados: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("nivel IN ('cecopal','pma')", name="ck_cecovi_usuario_temporal_nivel"),
    )
