"""Lectura SOLO LECTURA de recursos de COMACON, acotada por organization_id.

CECOVI lee `inventory_element` de COMACON como referencia viva; NUNCA escribe
aquí (la edición operativa es F5/overlay). Consulta acotada por la organización
de la emergencia (I6). Ver skill `comacon-db-access`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ComaconResourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_org(self, organization_id: int) -> list[dict[str, Any]]:
        # SELECT puro (sin ORM de COMACON): solo lectura, acotado por org.
        stmt = text(
            "SELECT resource_id, name, status, kind "
            "FROM inventory_element WHERE organization_id = :org ORDER BY name"
        )
        result = await self._session.execute(stmt, {"org": organization_id})
        return [
            {
                "resource_id": row.resource_id,
                "name": row.name,
                "status": row.status,
                "kind": row.kind,
            }
            for row in result
        ]
