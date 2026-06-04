"""F3 — operativo sanitario (víctimas, zonas, alertas)

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-04 04:00:00.000000
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def upgrade() -> None:
    op.create_table(
        "cecovi_san_victima",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("triage", sa.String(length=8), nullable=False, server_default="unset"),
        sa.Column("estado", sa.String(length=16), nullable=False, server_default="on-scene"),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_san_victima_emergencia"),
    )
    op.create_index("ix_cecovi_san_victima_emergencia_id", "cecovi_san_victima", ["emergencia_id"])

    op.create_table(
        "cecovi_san_zona",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("current", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(length=16), nullable=False, server_default="operational"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_san_zona_emergencia"),
    )
    op.create_index("ix_cecovi_san_zona_emergencia_id", "cecovi_san_zona", ["emergencia_id"])

    op.create_table(
        "cecovi_san_alerta",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("severity", sa.String(length=12), nullable=False, server_default="medium"),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _fk("fk_cecovi_san_alerta_emergencia"),
    )
    op.create_index("ix_cecovi_san_alerta_emergencia_id", "cecovi_san_alerta", ["emergencia_id"])


def downgrade() -> None:
    for t in ("cecovi_san_alerta", "cecovi_san_zona", "cecovi_san_victima"):
        op.drop_index(f"ix_{t}_emergencia_id", table_name=t)
        op.drop_table(t)
