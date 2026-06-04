"""F3 — operativo campo (tareas, reportes)

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-04 06:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def upgrade() -> None:
    op.create_table(
        "cecovi_campo_tarea",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("priority", sa.String(length=12), nullable=False, server_default="medium"),
        sa.Column("estado", sa.String(length=14), nullable=False, server_default="incoming"),
        sa.Column("assigned_to", sa.String(length=60), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        _fk("fk_cecovi_campo_tarea_emergencia"),
    )
    op.create_index("ix_cecovi_campo_tarea_emergencia_id", "cecovi_campo_tarea", ["emergencia_id"])

    op.create_table(
        "cecovi_campo_reporte",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("body", sa.String(length=4000), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("transcribed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_campo_reporte_emergencia"),
    )
    op.create_index("ix_cecovi_campo_reporte_emergencia_id", "cecovi_campo_reporte", ["emergencia_id"])


def downgrade() -> None:
    for t in ("cecovi_campo_reporte", "cecovi_campo_tarea"):
        op.drop_index(f"ix_{t}_emergencia_id", table_name=t)
        op.drop_table(t)
