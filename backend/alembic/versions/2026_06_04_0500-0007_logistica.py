"""F3 — operativo logística (suministros, solicitudes, servicios)

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-04 05:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def upgrade() -> None:
    op.create_table(
        "cecovi_logi_suministro",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("unit", sa.String(length=20), nullable=False, server_default="ud"),
        sa.Column("stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_stock", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("location", sa.String(length=160), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_logi_suministro_emergencia"),
    )
    op.create_index("ix_cecovi_logi_suministro_emergencia_id", "cecovi_logi_suministro", ["emergencia_id"])

    op.create_table(
        "cecovi_logi_solicitud",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("requested_by", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("item_name", sa.String(length=160), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(length=20), nullable=True),
        sa.Column("priority", sa.String(length=12), nullable=False, server_default="medium"),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="pending"),
        sa.Column("destination", sa.String(length=160), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        _fk("fk_cecovi_logi_solicitud_emergencia"),
    )
    op.create_index("ix_cecovi_logi_solicitud_emergencia_id", "cecovi_logi_solicitud", ["emergencia_id"])

    op.create_table(
        "cecovi_logi_servicio",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("area", sa.String(length=160), nullable=False),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="operational"),
        sa.Column("affected_population", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(length=120), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_logi_servicio_emergencia"),
    )
    op.create_index("ix_cecovi_logi_servicio_emergencia_id", "cecovi_logi_servicio", ["emergencia_id"])


def downgrade() -> None:
    for t in ("cecovi_logi_servicio", "cecovi_logi_solicitud", "cecovi_logi_suministro"):
        op.drop_index(f"ix_{t}_emergencia_id", table_name=t)
        op.drop_table(t)
