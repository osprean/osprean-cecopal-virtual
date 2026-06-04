"""F1 — núcleo CECOVI: emergencia, usuario_temporal, credencial, rol_seleccion, log

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-04 00:00:00.000000

ESCRITA A MANO (no autogenerate). Solo crea tablas `cecovi_*`; NUNCA toca el
esquema de COMACON. Ver skills `db-migration` y `comacon-db-access`.

FKs cruzadas a COMACON (`organization`, `emergencies`): se REFERENCIAN, no se
poseen. Requieren que el esquema de COMACON exista en la base destino (lo está
en la base compartida). NO llevan ON DELETE CASCADE: nada de borrados, el cierre
archiva por estado (I8). Las FK intra-CECOVI tampoco cascadean.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- cecovi_emergencia (raíz de tenancy) -------------------------------
    op.create_table(
        "cecovi_emergencia",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("comacon_emergency_id", sa.Integer(), nullable=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="activa"),
        sa.Column("modo", sa.String(length=20), nullable=False),
        sa.Column("nivel", sa.String(length=20), nullable=False, server_default="cecopal"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("finalizada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lectura_hasta", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archivada_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('activa','finalizada','cerrada','archivada')",
            name="ck_cecovi_emergencia_estado",
        ),
        sa.CheckConstraint("modo IN ('real','simulacro')", name="ck_cecovi_emergencia_modo"),
        sa.CheckConstraint("nivel IN ('cecopal','pma')", name="ck_cecovi_emergencia_nivel"),
    )
    op.create_index("ix_cecovi_emergencia_organization_id", "cecovi_emergencia", ["organization_id"])
    op.create_index("ix_cecovi_emergencia_slug", "cecovi_emergencia", ["slug"], unique=True)
    # FK cruzadas a COMACON (referencia viva; sin cascada). Requieren esquema COMACON.
    op.create_foreign_key(
        "fk_cecovi_emergencia_organization",
        "cecovi_emergencia", "organization", ["organization_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_cecovi_emergencia_comacon_emergency",
        "cecovi_emergencia", "emergencies", ["comacon_emergency_id"], ["id"],
    )

    # --- cecovi_usuario_temporal -------------------------------------------
    op.create_table(
        "cecovi_usuario_temporal",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=256), nullable=False),
        sa.Column("nivel", sa.String(length=20), nullable=False, server_default="cecopal"),
        sa.Column("solo_lectura", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("roles_confirmados", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"],
            name="fk_cecovi_usuario_temporal_emergencia",
        ),
        sa.CheckConstraint("nivel IN ('cecopal','pma')", name="ck_cecovi_usuario_temporal_nivel"),
    )
    op.create_index(
        "ix_cecovi_usuario_temporal_emergencia_id", "cecovi_usuario_temporal", ["emergencia_id"]
    )

    # --- cecovi_credencial --------------------------------------------------
    op.create_table(
        "cecovi_credencial",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("usuario_temporal_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="emitida"),
        sa.Column("expira_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("usada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"],
            name="fk_cecovi_credencial_emergencia",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_temporal_id"], ["cecovi_usuario_temporal.id"],
            name="fk_cecovi_credencial_usuario",
        ),
        sa.CheckConstraint(
            "estado IN ('emitida','activa','revocada','expirada')",
            name="ck_cecovi_credencial_estado",
        ),
    )
    op.create_index("ix_cecovi_credencial_emergencia_id", "cecovi_credencial", ["emergencia_id"])
    op.create_index(
        "ix_cecovi_credencial_usuario_temporal_id", "cecovi_credencial", ["usuario_temporal_id"]
    )

    # --- cecovi_rol_seleccion ----------------------------------------------
    op.create_table(
        "cecovi_rol_seleccion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("usuario_temporal_id", sa.Integer(), nullable=False),
        sa.Column("rol", sa.String(length=40), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("confirmada_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"],
            name="fk_cecovi_rol_seleccion_emergencia",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_temporal_id"], ["cecovi_usuario_temporal.id"],
            name="fk_cecovi_rol_seleccion_usuario",
        ),
    )
    op.create_index(
        "ix_cecovi_rol_seleccion_emergencia_id", "cecovi_rol_seleccion", ["emergencia_id"]
    )
    op.create_index(
        "ix_cecovi_rol_seleccion_usuario_temporal_id",
        "cecovi_rol_seleccion", ["usuario_temporal_id"],
    )
    # I1 — MANDO ÚNICO: como máximo un rol 'jefe' activo por emergencia.
    op.create_index(
        "uq_cecovi_jefe_activo",
        "cecovi_rol_seleccion",
        ["emergencia_id"],
        unique=True,
        postgresql_where=sa.text("rol = 'jefe' AND activo"),
    )

    # --- cecovi_log (append-only, I7) --------------------------------------
    op.create_table(
        "cecovi_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("emergencia_id", sa.Integer(), nullable=False),
        sa.Column("actor_usuario_id", sa.Integer(), nullable=True),
        sa.Column("accion", sa.String(length=80), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(
            ["emergencia_id"], ["cecovi_emergencia.id"],
            name="fk_cecovi_log_emergencia",
        ),
    )
    op.create_index("ix_cecovi_log_emergencia_id", "cecovi_log", ["emergencia_id"])


def downgrade() -> None:
    op.drop_index("ix_cecovi_log_emergencia_id", table_name="cecovi_log")
    op.drop_table("cecovi_log")

    op.drop_index("uq_cecovi_jefe_activo", table_name="cecovi_rol_seleccion")
    op.drop_index("ix_cecovi_rol_seleccion_usuario_temporal_id", table_name="cecovi_rol_seleccion")
    op.drop_index("ix_cecovi_rol_seleccion_emergencia_id", table_name="cecovi_rol_seleccion")
    op.drop_table("cecovi_rol_seleccion")

    op.drop_index("ix_cecovi_credencial_usuario_temporal_id", table_name="cecovi_credencial")
    op.drop_index("ix_cecovi_credencial_emergencia_id", table_name="cecovi_credencial")
    op.drop_table("cecovi_credencial")

    op.drop_index("ix_cecovi_usuario_temporal_emergencia_id", table_name="cecovi_usuario_temporal")
    op.drop_table("cecovi_usuario_temporal")

    op.drop_index("ix_cecovi_emergencia_slug", table_name="cecovi_emergencia")
    op.drop_index("ix_cecovi_emergencia_organization_id", table_name="cecovi_emergencia")
    op.drop_table("cecovi_emergencia")
