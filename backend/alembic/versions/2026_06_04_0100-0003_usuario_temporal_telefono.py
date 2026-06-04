"""F2.1 — telefono en cecovi_usuario_temporal

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-04 01:00:00.000000

Añade el teléfono del participante (sale del nodo CECOPAL → human_resource en
COMACON). Solo toca tabla cecovi_*. Ver db-migration / comacon-db-access.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cecovi_usuario_temporal",
        sa.Column("telefono", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cecovi_usuario_temporal", "telefono")
