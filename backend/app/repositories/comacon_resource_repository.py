"""Lectura SOLO LECTURA de recursos de COMACON, acotada por organization_id.

CECOVI lee `inventory_element` de COMACON como referencia viva; NUNCA escribe
aquí (la edición operativa es F5/overlay). Consulta acotada por la organización
de la emergencia (I6). Devuelve lat/lng renderables para el mapa del front.
Ver skill `comacon-db-access`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# En COMACON (PostGIS) la posición vive en `localization` (POINT 4326): se extrae
# con ST_X/ST_Y. En los tests (SQLite, sin PostGIS) el stub expone lat/lng.
_SQL_POSTGRES = text(
    "SELECT resource_id, name, status, kind, "
    "ST_Y(localization::geometry) AS lat, ST_X(localization::geometry) AS lng "
    "FROM inventory_element WHERE organization_id = :org ORDER BY name"
)
_SQL_OTHER = text(
    "SELECT resource_id, name, status, kind, lat, lng "
    "FROM inventory_element WHERE organization_id = :org ORDER BY name"
)


class ComaconResourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_org(self, organization_id: int) -> list[dict[str, Any]]:
        dialect = self._session.get_bind().dialect.name
        stmt = _SQL_POSTGRES if dialect == "postgresql" else _SQL_OTHER
        result = await self._session.execute(stmt, {"org": organization_id})
        return [
            {
                "resource_id": row.resource_id,
                "name": row.name,
                "status": row.status,
                "kind": row.kind,
                "lat": row.lat,
                "lng": row.lng,
            }
            for row in result
        ]
