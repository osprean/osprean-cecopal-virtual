"""organigrama_png_path en cecovi_emergencia.

Snapshot PNG del organigrama del CECOPAL recibido de COMACON al confirmar la
emergencia (campo `organigrama_png_b64` del webhook).

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-03 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("cecovi_emergencia", schema=None) as batch:
        batch.add_column(sa.Column("organigrama_png_path", sa.String(length=512), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cecovi_emergencia", schema=None) as batch:
        batch.drop_column("organigrama_png_path")
