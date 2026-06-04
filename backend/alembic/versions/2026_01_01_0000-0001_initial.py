"""baseline vacía de CECOVI

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00.000000

NOTA: esta revisión es una BASELINE VACÍA a propósito.

CECOVI comparte la base PostgreSQL con COMACON y solo migra sus tablas
`cecovi_*`. La plantilla `osprean-webapp-template` traía aquí un esquema de
ejemplo (`users` + `items`); se ha vaciado para que un `alembic upgrade head`
accidental (p. ej. RUN_MIGRATIONS=1 en el entrypoint) NO cree tablas ajenas en
la base compartida de COMACON.

Las tablas reales de CECOVI las crean las revisiones de F1 en adelante,
encadenadas a partir de esta (`down_revision = "0001"`). Ver skill `db-migration`.
"""
from __future__ import annotations

from collections.abc import Sequence

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Baseline: no crea nada. Las tablas `cecovi_*` llegan en F1+."""


def downgrade() -> None:
    """Baseline: nada que revertir."""
