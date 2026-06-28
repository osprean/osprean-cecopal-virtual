"""Credencial temporal de acceso a una emergencia.

Cambios P3 (master/backup):
- `tipo` ∈ `{master, backup}`: master es la titular del rol (posición 1 del
  organigrama); backup la comparten los suplentes (posición 2..N).
- `roles` (CSV): roles asignados (D4 — roles compuestos en una sola credencial).
- `usuario_temporal_id` opcional (la master tiene asignado, la backup compartida
  no nomina destinatario fijo; se asocia al usuario al primer login).
- `deshabilitada_por_credencial_id`: cuando el master entra, marca las backup del
  mismo (emergencia, rol) como `deshabilitada` apuntando al master que la cerró
  (audit).

Solo se almacena el hash del token, nunca el valor en claro (el claro va en el
email).
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
    # Master tiene usuario titular asignado; backup compartida puede ser NULL
    # hasta el primer login (entonces se nomina al usuario que la usó).
    usuario_temporal_id: Mapped[int | None] = mapped_column(
        ForeignKey("cecovi_usuario_temporal.id"), nullable=True, index=True
    )

    tipo: Mapped[str] = mapped_column(String(8), nullable=False, server_default="master")
    # Roles asignados a la credencial, CSV (D4 — roles compuestos). Ej:
    # "direccion" o "logistica,sanitario". Lo lee `permisos_de_roles`.
    roles: Mapped[str] = mapped_column(String(120), nullable=False, server_default="")

    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, server_default="emitida")

    # Cuando un master entra, marca las backups del mismo (emergencia, rol) con
    # estado='deshabilitada' apuntando a sí mismo aquí.
    deshabilitada_por_credencial_id: Mapped[int | None] = mapped_column(
        ForeignKey("cecovi_credencial.id"), nullable=True
    )

    expira_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    usada_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "estado IN ('emitida','activa','revocada','expirada','deshabilitada')",
            name="ck_cecovi_credencial_estado",
        ),
        CheckConstraint("tipo IN ('master','backup')", name="ck_cecovi_credencial_tipo"),
    )

    def roles_list(self) -> list[str]:
        """Devuelve los roles como lista (split del CSV)."""
        return [r.strip() for r in (self.roles or "").split(",") if r.strip()]
