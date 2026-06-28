"""P5 — tareas operativas (snapshot del diagrama de actividades).

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-23 01:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cecovi_tarea",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("rol", sa.String(length=40), nullable=False),
        sa.Column("codigo", sa.String(length=40), nullable=True),
        sa.Column("titulo", sa.String(length=160), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(length=14), nullable=False, server_default="pending"),
        sa.Column("comacon_activity_id", sa.Integer(), nullable=True),
        sa.Column("accepted_by_id", sa.Integer(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"], name="fk_cecovi_tarea_emergencia"
        ),
        sa.ForeignKeyConstraint(
            ["accepted_by_id"], ["cecovi_usuario_temporal.id"], name="fk_cecovi_tarea_aceptada_por"
        ),
        sa.CheckConstraint(
            "estado IN ('pending','accepted','completed','cancelled')",
            name="ck_cecovi_tarea_estado",
        ),
    )
    op.create_index("ix_cecovi_tarea_emergencia_id", "cecovi_tarea", ["emergencia_id"])
    op.create_index("ix_cecovi_tarea_rol", "cecovi_tarea", ["rol"])


def downgrade() -> None:
    op.drop_index("ix_cecovi_tarea_rol", table_name="cecovi_tarea")
    op.drop_index("ix_cecovi_tarea_emergencia_id", table_name="cecovi_tarea")
    op.drop_table("cecovi_tarea")
