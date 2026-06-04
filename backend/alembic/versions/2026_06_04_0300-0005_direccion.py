"""F3 — operativo dirección (grupos, solicitudes, comunicados, albergues)

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-04 03:00:00.000000

Solo tablas cecovi_*. Ver db-migration.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def _idx(table: str) -> None:
    op.create_index(f"ix_{table}_emergencia_id", table, ["emergencia_id"])


def upgrade() -> None:
    op.create_table(
        "cecovi_dir_grupo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=24), nullable=False),
        sa.Column("estado", sa.String(length=16), nullable=False, server_default="operational"),
        sa.Column("members_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("members_active", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("leader", sa.String(length=120), nullable=True),
        sa.Column("channel", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        _fk("fk_cecovi_dir_grupo_emergencia"),
    )
    _idx("cecovi_dir_grupo")

    op.create_table(
        "cecovi_dir_solicitud_medios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("requested_by", sa.String(length=120), nullable=False),
        sa.Column("resource_type", sa.String(length=40), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("priority", sa.String(length=12), nullable=False, server_default="medium"),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        _fk("fk_cecovi_dir_solicitud_emergencia"),
    )
    _idx("cecovi_dir_solicitud_medios")

    op.create_table(
        "cecovi_dir_comunicado",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.String(length=4000), nullable=False),
        sa.Column("audience", sa.String(length=16), nullable=False, server_default="internal"),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("created_by", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_dir_comunicado_emergencia"),
    )
    _idx("cecovi_dir_comunicado")

    op.create_table(
        "cecovi_dir_albergue",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("occupancy", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(length=16), nullable=False, server_default="operational"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_dir_albergue_emergencia"),
    )
    _idx("cecovi_dir_albergue")


def downgrade() -> None:
    for t in ("cecovi_dir_albergue", "cecovi_dir_comunicado", "cecovi_dir_solicitud_medios", "cecovi_dir_grupo"):
        op.drop_index(f"ix_{t}_emergencia_id", table_name=t)
        op.drop_table(t)
