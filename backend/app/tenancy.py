"""Resolución de `/{idEmergencia}` y aislamiento multi-tenant (I6).

Patrón canónico: TODO endpoint operativo cuelga de `/emergencias/{id_emergencia}/...`
y depende de `EmergenciaCtx`, que:
  1. resuelve el slug → 404 si no existe (`resolve_emergencia`);
  2. exige credencial válida para ESA emergencia → 403 si no (`require_emergencia_access`).
El `emergencia.id` resultante es el ÚNICO origen de tenancy: los repos filtran
siempre por él.

El acceso se concede cuando el JWT temporal lleva el claim `emergencia_id`
coincidente con el slug resuelto (lo emite el login de F2). Orden garantizado:
404 (slug) → 403 (sin credencial) → principal.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.exceptions import AuthError, ForbiddenError, NotFoundError
from app.deps import DbSession, TokenSvc, oauth2_scheme
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.repositories.emergencia_repository import EmergenciaRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository


async def resolve_emergencia(id_emergencia: str, db: DbSession) -> CecoviEmergencia:
    """Resuelve el slug de la ruta. 404 si no existe."""
    emergencia = await EmergenciaRepository(db).get_by_slug(id_emergencia)
    if emergencia is None:
        raise NotFoundError("La emergencia no existe", code="emergencia_not_found")
    return emergencia


ResolvedEmergencia = Annotated[CecoviEmergencia, Depends(resolve_emergencia)]

Token = Annotated[str | None, Depends(oauth2_scheme)]


async def require_emergencia_access(
    emergencia: ResolvedEmergencia,
    token: Token,
    tokens: TokenSvc,
) -> CecoviEmergencia:
    """Exige credencial válida para ESTA emergencia. 403 si no la hay.

    - Sin token o token de otra emergencia → 403 (no se revela contenido).
    - Token inválido/caducado → 401 (problema del token).
    """
    if not token:
        raise ForbiddenError("Acceso denegado a esta emergencia", code="emergencia_forbidden")
    claims = tokens.decode_claims(token, expected_type="access")  # AuthError → 401
    if claims.get("emergencia_id") != emergencia.id:
        raise ForbiddenError("Acceso denegado a esta emergencia", code="emergencia_forbidden")
    return emergencia


# Contexto de tenancy para endpoints operativos: 404 → 403 → emergencia acotada.
EmergenciaCtx = Annotated[CecoviEmergencia, Depends(require_emergencia_access)]


async def get_principal(
    emergencia: EmergenciaCtx,
    token: Token,
    tokens: TokenSvc,
    db: DbSession,
) -> CecoviUsuarioTemporal:
    """Usuario temporal autenticado (principal de CECOVI), acotado a la emergencia."""
    assert token is not None  # EmergenciaCtx ya garantizó token válido para esta emergencia
    claims = tokens.decode_claims(token, expected_type="access")
    usuario = await UsuarioTemporalRepository(db).get_in_emergencia(
        emergencia_id=emergencia.id, usuario_id=int(claims["sub"])
    )
    if usuario is None:
        raise AuthError("Principal no encontrado", code="principal_not_found")
    return usuario


Principal = Annotated[CecoviUsuarioTemporal, Depends(get_principal)]
