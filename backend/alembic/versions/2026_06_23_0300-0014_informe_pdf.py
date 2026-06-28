"""P11 — informe_pdf_path en cecovi_emergencia.

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-23 03:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("cecovi_emergencia", schema=None) as batch:
        batch.add_column(sa.Column("informe_pdf_path", sa.String(length=512), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("cecovi_emergencia", schema=None) as batch:
        batch.drop_column("informe_pdf_path")
