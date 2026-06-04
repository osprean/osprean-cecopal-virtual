"""F3 — evacuación (dirección) + FK real en gab_publicacion

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-04 08:00:00.000000

Añade cecovi_dir_evacuacion (ruta + evacuados enlazados a albergue) y convierte
las referencias de cecovi_gab_publicacion (comunicado_id, canal_id) en FKs reales
(misma DB, sin borrados → integridad a coste cero).
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cecovi_dir_evacuacion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("estado", sa.String(length=14), nullable=False, server_default="planned"),
        sa.Column("albergue_id", sa.Integer(), nullable=True),
        sa.Column("estimated_people", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evacuated_people", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("route_points", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["emergencia_id"], ["cecovi_emergencia.id"], name="fk_cecovi_dir_evacuacion_emergencia"),
        sa.ForeignKeyConstraint(["albergue_id"], ["cecovi_dir_albergue.id"], name="fk_cecovi_dir_evacuacion_albergue"),
    )
    op.create_index("ix_cecovi_dir_evacuacion_emergencia_id", "cecovi_dir_evacuacion", ["emergencia_id"])

    # FKs reales en gab_publicacion (antes referencias por id sin FK).
    with op.batch_alter_table("cecovi_gab_publicacion", schema=None) as batch:
        batch.create_foreign_key(
            "fk_cecovi_gab_publicacion_comunicado", "cecovi_dir_comunicado", ["comunicado_id"], ["id"]
        )
        batch.create_foreign_key(
            "fk_cecovi_gab_publicacion_canal", "cecovi_gab_canal", ["canal_id"], ["id"]
        )


def downgrade() -> None:
    with op.batch_alter_table("cecovi_gab_publicacion", schema=None) as batch:
        batch.drop_constraint("fk_cecovi_gab_publicacion_canal", type_="foreignkey")
        batch.drop_constraint("fk_cecovi_gab_publicacion_comunicado", type_="foreignkey")
    op.drop_index("ix_cecovi_dir_evacuacion_emergencia_id", table_name="cecovi_dir_evacuacion")
    op.drop_table("cecovi_dir_evacuacion")
