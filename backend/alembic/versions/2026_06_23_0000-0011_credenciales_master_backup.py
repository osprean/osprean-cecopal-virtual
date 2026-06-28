"""P3 — credenciales master/backup + tabla cecovi_sesion

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-23 00:00:00.000000

Cambios en cecovi_credencial:
- usuario_temporal_id pasa a nullable (backup compartida no nomina destinatario
  hasta el primer login).
- tipo ∈ {master, backup}.
- roles CSV (D4 — roles compuestos en una sola credencial).
- deshabilitada_por_credencial_id (FK self) para audit cuando master entra.
- estado amplía a 'deshabilitada'.

Nueva tabla cecovi_sesion (sesión única por credencial via índice parcial).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- cecovi_credencial: nullable usuario_temporal_id + nuevas columnas ---
    with op.batch_alter_table("cecovi_credencial", schema=None) as batch:
        batch.alter_column("usuario_temporal_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(
            sa.Column("tipo", sa.String(length=8), nullable=False, server_default="master")
        )
        batch.add_column(
            sa.Column("roles", sa.String(length=120), nullable=False, server_default="")
        )
        batch.add_column(
            sa.Column(
                "deshabilitada_por_credencial_id",
                sa.Integer(),
                sa.ForeignKey("cecovi_credencial.id", name="fk_cecovi_cred_deshab"),
                nullable=True,
            )
        )
        batch.drop_constraint("ck_cecovi_credencial_estado", type_="check")
        batch.create_check_constraint(
            "ck_cecovi_credencial_estado",
            "estado IN ('emitida','activa','revocada','expirada','deshabilitada')",
        )
        batch.create_check_constraint(
            "ck_cecovi_credencial_tipo", "tipo IN ('master','backup')"
        )

    # --- nueva tabla cecovi_sesion ---
    op.create_table(
        "cecovi_sesion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("credencial_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("usuario_temporal_id", sa.Integer(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_reason", sa.String(length=40), nullable=True),
        sa.ForeignKeyConstraint(
            ["credencial_id"], ["cecovi_credencial.id"], name="fk_cecovi_sesion_credencial"
        ),
        sa.ForeignKeyConstraint(
            ["usuario_temporal_id"],
            ["cecovi_usuario_temporal.id"],
            name="fk_cecovi_sesion_usuario",
        ),
        sa.UniqueConstraint("jti", name="uq_cecovi_sesion_jti"),
    )
    op.create_index("ix_cecovi_sesion_credencial_id", "cecovi_sesion", ["credencial_id"])
    # Una sola sesión activa por credencial.
    op.create_index(
        "uq_cecovi_sesion_activa",
        "cecovi_sesion",
        ["credencial_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_cecovi_sesion_activa", table_name="cecovi_sesion")
    op.drop_index("ix_cecovi_sesion_credencial_id", table_name="cecovi_sesion")
    op.drop_table("cecovi_sesion")

    with op.batch_alter_table("cecovi_credencial", schema=None) as batch:
        batch.drop_constraint("ck_cecovi_credencial_tipo", type_="check")
        batch.drop_constraint("ck_cecovi_credencial_estado", type_="check")
        batch.create_check_constraint(
            "ck_cecovi_credencial_estado",
            "estado IN ('emitida','activa','revocada','expirada')",
        )
        batch.drop_constraint("fk_cecovi_cred_deshab", type_="foreignkey")
        batch.drop_column("deshabilitada_por_credencial_id")
        batch.drop_column("roles")
        batch.drop_column("tipo")
        batch.alter_column("usuario_temporal_id", existing_type=sa.Integer(), nullable=False)
