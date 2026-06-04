"""F3 — operativo seguridad + dedupe comacon_emergency_id

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-04 02:00:00.000000

Tablas operativas del área de seguridad (cecovi_seg_*) con emergencia_id (I6) y
geometría plana/JSON. Además: índice único parcial sobre
cecovi_emergencia.comacon_emergency_id (WHERE NOT NULL) como dedupe a nivel de
datos (defensa en profundidad frente a un doble webhook de COMACON).

Solo toca tablas cecovi_*. Ver skills db-migration / comacon-db-access.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _emergencia_fk(name: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name=name)


def upgrade() -> None:
    # --- dedupe a nivel de datos: una emergencia COMACON ↔ una emergencia CECOVI ---
    op.create_index(
        "uq_cecovi_emergencia_comacon_id",
        "cecovi_emergencia",
        ["comacon_emergency_id"],
        unique=True,
        postgresql_where=sa.text("comacon_emergency_id IS NOT NULL"),
    )

    op.create_table(
        "cecovi_seg_perimetro",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("shape", sa.String(length=10), nullable=False),
        sa.Column("points", sa.JSON(), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lng", sa.Float(), nullable=True),
        sa.Column("radius_m", sa.Float(), nullable=True),
        sa.Column("nivel", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _emergencia_fk("fk_cecovi_seg_perimetro_emergencia"),
    )
    op.create_index("ix_cecovi_seg_perimetro_emergencia_id", "cecovi_seg_perimetro", ["emergencia_id"])

    op.create_table(
        "cecovi_seg_acceso",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("estado", sa.String(length=12), nullable=False, server_default="open"),
        sa.Column("units", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        _emergencia_fk("fk_cecovi_seg_acceso_emergencia"),
    )
    op.create_index("ix_cecovi_seg_acceso_emergencia_id", "cecovi_seg_acceso", ["emergencia_id"])

    op.create_table(
        "cecovi_seg_corte",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("road", sa.String(length=160), nullable=False),
        sa.Column("km", sa.String(length=20), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("segment", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("estado", sa.String(length=14), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _emergencia_fk("fk_cecovi_seg_corte_emergencia"),
    )
    op.create_index("ix_cecovi_seg_corte_emergencia_id", "cecovi_seg_corte", ["emergencia_id"])

    op.create_table(
        "cecovi_seg_incidencia",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("tipo", sa.String(length=24), nullable=False),
        sa.Column("severity", sa.String(length=12), nullable=False),
        sa.Column("estado", sa.String(length=14), nullable=False, server_default="active"),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        _emergencia_fk("fk_cecovi_seg_incidencia_emergencia"),
    )
    op.create_index("ix_cecovi_seg_incidencia_emergencia_id", "cecovi_seg_incidencia", ["emergencia_id"])


def downgrade() -> None:
    op.drop_index("ix_cecovi_seg_incidencia_emergencia_id", table_name="cecovi_seg_incidencia")
    op.drop_table("cecovi_seg_incidencia")
    op.drop_index("ix_cecovi_seg_corte_emergencia_id", table_name="cecovi_seg_corte")
    op.drop_table("cecovi_seg_corte")
    op.drop_index("ix_cecovi_seg_acceso_emergencia_id", table_name="cecovi_seg_acceso")
    op.drop_table("cecovi_seg_acceso")
    op.drop_index("ix_cecovi_seg_perimetro_emergencia_id", table_name="cecovi_seg_perimetro")
    op.drop_table("cecovi_seg_perimetro")
    op.drop_index("uq_cecovi_emergencia_comacon_id", table_name="cecovi_emergencia")
