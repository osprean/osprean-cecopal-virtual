"""Entidades operativas del área GABINETE (canales y publicaciones).

Derivadas del gabineteStore. Los comunicados se gestionan en el área de
dirección (jefe); aquí se gestionan canales de difusión y publicaciones (que
referencian un comunicado por id). emergencia_id en todo (I6).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CecoviGabCanal(Base):
    __tablename__ = "cecovi_gab_canal"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(24), nullable=False)  # press|social-x|es-alert|...
    estado: Mapped[str] = mapped_column(String(12), nullable=False, server_default="online")
    audience_reach: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CecoviGabPublicacion(Base):
    __tablename__ = "cecovi_gab_publicacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    emergencia_id: Mapped[int] = mapped_column(
        ForeignKey("cecovi_emergencia.id"), nullable=False, index=True
    )
    # FK reales intra-CECOVI (misma DB, sin borrados): comunicado de dirección + canal.
    comunicado_id: Mapped[int | None] = mapped_column(ForeignKey("cecovi_dir_comunicado.id"))
    canal_id: Mapped[int | None] = mapped_column(ForeignKey("cecovi_gab_canal.id"))
    estado: Mapped[str] = mapped_column(String(16), nullable=False, server_default="draft")
    reach: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
