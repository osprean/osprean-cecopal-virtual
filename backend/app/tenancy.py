"""Resolución de `/{idEmergencia}` y aislamiento multi-tenant (I6).

Patrón canónico: TODO endpoint operativo cuelga de `/emergencias/{id_emergencia}/...`
y depende de `EmergenciaCtx`, que:
  1. resuelve el slug → 404 si no existe (`resolve_emergencia`);
  2. exige credencial válida para ESA emergencia → 403 si no (`require_emergencia_access`).
El `emergencia.id` resultante es el ÚNICO origen de tenancy: los repos filtran
siempre por él.

Cambios P3:
- El JWT `sub` ahora es `credencial_id` (no `usuario_temporal_id`).
- Claims `roles` (lista) + `tipo` (master|backup) + `jti` (sesión).
- Validamos que la sesión esté ACTIVA (jti ↔ cecovi_sesion con ended_at IS NULL).
- `Principal` resuelve a `cecovi_usuario_temporal` desde `claims["usuario_id"]`
  para audit; puede ser None en backups compartidas (raro).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError, ForbiddenError, NotFoundError
from app.core.security import TokenService
from app.deps import DbSession, TokenSvc, oauth2_scheme
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_sesion import CecoviSesion
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


@dataclass
class SessionCtx:
    """Contexto de sesión derivado del JWT, ya validado contra la DB."""

    credencial_id: int
    roles: list[str]
    tipo: str  # master|backup
    jti: str
    usuario_id: int | None
    emergencia_id: int


async def _decode_and_validate_session(
    token: str, tokens: TokenService, db: AsyncSession
) -> SessionCtx:
    """Decodifica el JWT y verifica que la sesión `jti` siga activa."""
    claims: dict[str, Any] = tokens.decode_claims(token, expected_type="access")
    jti = claims.get("jti")
    if not jti:
        raise AuthError("Token sin jti", code="token_invalid")
    stmt = select(CecoviSesion).where(CecoviSesion.jti == jti, CecoviSesion.ended_at.is_(None))
    sesion = (await db.execute(stmt)).scalar_one_or_none()
    if sesion is None:
        raise AuthError("Sesión terminada", code="sesion_terminada")
    # ping
    sesion.last_seen_at = datetime.now(UTC)
    return SessionCtx(
        credencial_id=int(claims["sub"]),
        roles=list(claims.get("roles", [])),
        tipo=str(claims.get("tipo", "master")),
        jti=jti,
        usuario_id=claims.get("usuario_id"),
        emergencia_id=int(claims["emergencia_id"]),
    )


async def require_emergencia_access(
    emergencia: ResolvedEmergencia,
    token: Token,
    tokens: TokenSvc,
    db: DbSession,
) -> CecoviEmergencia:
    """Exige credencial válida y sesión activa para ESTA emergencia. 403 si no la hay.

    - Sin token o token de otra emergencia → 403.
    - Token inválido/caducado → 401 (AuthError de decode_claims).
    - Sesión terminada (jti no activo) → 401.
    """
    if not token:
        raise ForbiddenError("Acceso denegado a esta emergencia", code="emergencia_forbidden")
    ctx = await _decode_and_validate_session(token, tokens, db)
    if ctx.emergencia_id != emergencia.id:
        raise ForbiddenError("Acceso denegado a esta emergencia", code="emergencia_forbidden")
    return emergencia


EmergenciaCtx = Annotated[CecoviEmergencia, Depends(require_emergencia_access)]


async def get_session_ctx(
    emergencia: EmergenciaCtx,
    token: Token,
    tokens: TokenSvc,
    db: DbSession,
) -> SessionCtx:
    """Contexto de sesión actual (credencial, roles, usuario_id si lo hay)."""
    assert token is not None  # EmergenciaCtx ya validó
    return await _decode_and_validate_session(token, tokens, db)


SessionDep = Annotated[SessionCtx, Depends(get_session_ctx)]


async def get_principal(
    emergencia: EmergenciaCtx,
    session: SessionDep,
    db: DbSession,
) -> CecoviUsuarioTemporal:
    """Usuario temporal autenticado (principal de CECOVI), acotado a la emergencia.

    En backup compartida puede no haber `usuario_id` hasta el primer login; en
    ese caso lanzamos 401 (la flow debería haber nominado a alguien)."""
    if session.usuario_id is None:
        raise AuthError("Principal no encontrado", code="principal_not_found")
    usuario = await UsuarioTemporalRepository(db).get_in_emergencia(
        emergencia_id=emergencia.id, usuario_id=session.usuario_id
    )
    if usuario is None:
        raise AuthError("Principal no encontrado", code="principal_not_found")
    return usuario


Principal = Annotated[CecoviUsuarioTemporal, Depends(get_principal)]
