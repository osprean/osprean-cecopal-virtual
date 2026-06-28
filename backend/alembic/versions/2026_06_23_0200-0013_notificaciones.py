"""P9 — notificaciones cross-area (polling 30s).

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-23 02:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cecovi_notificacion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("rol_destino", sa.String(length=40), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(length=40), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column(
            "payload",
            sa.JSON().with_variant(JSONB(), "postgresql"),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("leida_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"], name="fk_cecovi_notif_emergencia"
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["cecovi_usuario_temporal.id"], name="fk_cecovi_notif_actor"
        ),
    )
    op.create_index("ix_cecovi_notif_emergencia_id", "cecovi_notificacion", ["emergencia_id"])
    op.create_index("ix_cecovi_notif_rol", "cecovi_notificacion", ["rol_destino"])
    op.create_index("ix_cecovi_notif_created_at", "cecovi_notificacion", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_cecovi_notif_created_at", table_name="cecovi_notificacion")
    op.drop_index("ix_cecovi_notif_rol", table_name="cecovi_notificacion")
    op.drop_index("ix_cecovi_notif_emergencia_id", table_name="cecovi_notificacion")
    op.drop_table("cecovi_notificacion")
