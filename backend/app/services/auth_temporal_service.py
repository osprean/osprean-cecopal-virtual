"""Login con credencial temporal → JWT acotado a una emergencia.

El JWT lleva sub=usuario_temporal_id, emergencia_id y nivel; ese `emergencia_id`
es lo que cierra el 403 del resolver (ver app/tenancy.py). Mantiene el
TokenService swappable (Protocol) para un IdP futuro.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.credenciales import parsear_token
from app.core.exceptions import AuthError
from app.core.security import PasswordHasher, TokenService
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.log_repository import LogRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository


@dataclass
class LoginResult:
    access_token: str
    emergencia_id: int
    nivel: str


class AuthTemporalService:
    def __init__(
        self,
        *,
        credenciales: CredencialRepository,
        usuarios: UsuarioTemporalRepository,
        logs: LogRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
    ) -> None:
        self._credenciales = credenciales
        self._usuarios = usuarios
        self._logs = logs
        self._hasher = hasher
        self._tokens = tokens

    async def login(self, *, emergencia_id: int, token: str) -> LoginResult:
        cred_id, secreto = parsear_token(token)
        cred = await self._credenciales.get_in_emergencia(
            emergencia_id=emergencia_id, credencial_id=cred_id
        )
        if cred is None:
            raise AuthError("Credencial inválida", code="bad_credential")
        if cred.estado in ("revocada", "expirada"):
            raise AuthError("Credencial no válida", code="credential_revoked")
        if cred.expira_at is not None:
            # SQLite no preserva tzinfo; normalizamos a UTC para comparar.
            expira = cred.expira_at
            if expira.tzinfo is None:
                expira = expira.replace(tzinfo=UTC)
            if datetime.now(UTC) > expira:
                raise AuthError("Credencial caducada", code="credential_expired")
        if not self._hasher.verify(secreto, cred.token_hash):
            raise AuthError("Credencial inválida", code="bad_credential")

        usuario = await self._usuarios.get_in_emergencia(
            emergencia_id=emergencia_id, usuario_id=cred.usuario_temporal_id
        )
        if usuario is None:  # incoherencia de datos; no debería ocurrir
            raise AuthError("Credencial inválida", code="bad_credential")

        cred.estado = "activa"
        cred.usada_at = datetime.now(UTC)

        access = self._tokens.create_access_token(
            str(usuario.id),
            extra_claims={"emergencia_id": emergencia_id, "nivel": usuario.nivel},
        )
        await self._logs.add(
            emergencia_id=emergencia_id,
            accion="login",
            actor_usuario_id=usuario.id,
            payload={"credencial_id": cred.id},
        )
        return LoginResult(access_token=access, emergencia_id=emergencia_id, nivel=usuario.nivel)
