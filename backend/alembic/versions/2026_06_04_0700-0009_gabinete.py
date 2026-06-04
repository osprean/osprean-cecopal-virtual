"""F3 — operativo gabinete (canales, publicaciones)

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-04 07:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def upgrade() -> None:
    op.create_table(
        "cecovi_gab_canal",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="online"),
        sa.Column("audience_reach", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_gab_canal_emergencia"),
    )
    op.create_index("ix_cecovi_gab_canal_emergencia_id", "cecovi_gab_canal", ["emergencia_id"])

    op.create_table(
        "cecovi_gab_publicacion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("comunicado_id", sa.Integer(), nullable=True),
        sa.Column("canal_id", sa.Integer(), nullable=True),
        sa.Column("estado", sa.String(length=16), nullable=False, server_default="draft"),
        sa.Column("reach", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_gab_publicacion_emergencia"),
    )
    op.create_index("ix_cecovi_gab_publicacion_emergencia_id", "cecovi_gab_publicacion", ["emergencia_id"])


def downgrade() -> None:
    for t in ("cecovi_gab_publicacion", "cecovi_gab_canal"):
        op.drop_index(f"ix_{t}_emergencia_id", table_name=t)
        op.drop_table(t)
