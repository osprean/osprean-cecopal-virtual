"""Lectura SOLO LECTURA de recursos de COMACON, acotada por organization_id (P7).

CECOVI lee `inventory_element` de COMACON como referencia viva; NUNCA escribe
aquí (la edición operativa es F5/overlay). Devuelve también campos ampliados
(observations) y, si el recurso es HR, datos del HR (phone_number, organism,
linked_user_email).

Ver skill `comacon-db-access`. Acotado por organización (I6).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# En COMACON (PostGIS) la posición vive en `localization` (POINT 4326): se extrae
# con ST_X/ST_Y. En los tests (SQLite, sin PostGIS) el stub expone lat/lng.
# Hacemos LEFT JOIN a human_resource + usuario para enriquecer HR; el resto de
# tipos vienen con campos NULL.
_SQL_POSTGRES = text(
    """
    SELECT
      ie.resource_id, ie.name, ie.status, ie.kind, ie.observations,
      ST_Y(ie.localization::geometry) AS lat,
      ST_X(ie.localization::geometry) AS lng,
      hr.phone_number, hr.organism,
      u.email AS linked_user_email
    FROM inventory_element ie
    LEFT JOIN human_resource hr ON hr.resource_id = ie.resource_id
    LEFT JOIN usuario u ON u.id = hr.linked_user_id
    WHERE ie.organization_id = :org
    ORDER BY ie.name
    """
)
_SQL_OTHER = text(
    """
    SELECT
      ie.resource_id, ie.name, ie.status, ie.kind, ie.observations,
      ie.lat, ie.lng,
      hr.phone_number, hr.organism,
      u.email AS linked_user_email
    FROM inventory_element ie
    LEFT JOIN human_resource hr ON hr.resource_id = ie.resource_id
    LEFT JOIN usuario u ON u.id = hr.linked_user_id
    WHERE ie.organization_id = :org
    ORDER BY ie.name
    """
)


class ComaconResourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_org(self, organization_id: int) -> list[dict[str, Any]]:
        dialect = self._session.get_bind().dialect.name
        stmt = _SQL_POSTGRES if dialect == "postgresql" else _SQL_OTHER
        try:
            result = await self._session.execute(stmt, {"org": organization_id})
        except Exception:
            # Si las tablas auxiliares (human_resource/usuario) no existen en el
            # stub de tests, caemos a la query simple (solo inventory_element).
            await self._session.rollback()
            simple = text(
                "SELECT resource_id, name, status, kind, NULL AS observations, "
                + ("ST_Y(localization::geometry) AS lat, ST_X(localization::geometry) AS lng, "
                   if dialect == "postgresql" else "lat, lng, ")
                + "NULL AS phone_number, NULL AS organism, NULL AS linked_user_email "
                "FROM inventory_element WHERE organization_id = :org ORDER BY name"
            )
            result = await self._session.execute(simple, {"org": organization_id})
        return [
            {
                "resource_id": row.resource_id,
                "name": row.name,
                "status": row.status,
                "kind": row.kind,
                "lat": row.lat,
                "lng": row.lng,
                "observations": row.observations,
                "phone_number": row.phone_number,
                "organism": row.organism,
                "linked_user_email": row.linked_user_email,
            }
            for row in result
        ]
