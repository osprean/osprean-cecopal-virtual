"""Resolución de `/{idEmergencia}` y aislamiento multi-tenant (I6).

Patrón canónico: TODO endpoint operativo cuelga de `/emergencias/{id_emergencia}/...`
y depende de `EmergenciaCtx`, que:
  1. resuelve el slug → 404 si no existe (`resolve_emergencia`);
  2. exige credencial válida para ESA emergencia → 403 si no (`require_emergencia_access`).
El `emergencia.id` resultante es el ÚNICO origen de tenancy: los repos filtran
siempre por él. Ningún acceso a datos operativos debe saltarse este contexto.

Orden garantizado: `require_emergencia_access` depende de `resolve_emergencia`,
así que el 404 (slug inexistente) se evalúa antes que el 403 (sin credencial).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.exceptions import ForbiddenError, NotFoundError
from app.deps import DbSession, oauth2_scheme
from app.models.cecovi_emergencia import CecoviEmergencia
from app.repositories.emergencia_repository import EmergenciaRepository


async def resolve_emergencia(id_emergencia: str, db: DbSession) -> CecoviEmergencia:
    """Resuelve el slug de la ruta. 404 si no existe."""
    emergencia = await EmergenciaRepository(db).get_by_slug(id_emergencia)
    if emergencia is None:
        raise NotFoundError("La emergencia no existe", code="emergencia_not_found")
    return emergencia


ResolvedEmergencia = Annotated[CecoviEmergencia, Depends(resolve_emergencia)]


def _emergencia_id_from_token(token: str | None) -> int | None:
    """Extrae el `emergencia_id` del JWT temporal.

    F1: el JWT con el claim `emergencia_id` se emite en el login con credencial
    temporal (F2). Hasta entonces no existe credencial de emergencia válida, por
    lo que esto devuelve None y el guard responde 403. El PUNTO DE CONTROL queda
    escrito aquí; F2 solo implementa esta extracción y el guard empieza a
    conceder acceso sin cambiar su lógica.
    """
    return None  # TODO(F2): decodificar el claim emergencia_id del token temporal


async def require_emergencia_access(
    emergencia: ResolvedEmergencia,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> CecoviEmergencia:
    """Exige credencial válida para esta emergencia. 403 si no la hay."""
    claim = _emergencia_id_from_token(token)
    if claim is None or claim != emergencia.id:
        raise ForbiddenError("Acceso denegado a esta emergencia", code="emergencia_forbidden")
    return emergencia


# Contexto de tenancy para endpoints operativos: 404 → 403 → emergencia acotada.
EmergenciaCtx = Annotated[CecoviEmergencia, Depends(require_emergencia_access)]
