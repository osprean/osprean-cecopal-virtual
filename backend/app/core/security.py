"""Auth primitives: hashing y JWT.

Diseñado como Protocols swappables. Para migrar a Keycloak/Authentik basta
con implementar `TokenService` apuntando al OIDC provider y reinyectarlo
en deps; los endpoints de /auth no se tocan (más allá de quitar /register).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal, Protocol

import bcrypt
import jwt

from app.config import get_settings
from app.core.exceptions import AuthError

TokenType = Literal["access", "refresh"]

# bcrypt limita la contraseña a 72 bytes; truncamos como hacía passlib.
_BCRYPT_MAX_BYTES = 72


class PasswordHasher(Protocol):
    def hash(self, raw: str) -> str: ...
    def verify(self, raw: str, hashed: str) -> bool: ...


class TokenService(Protocol):
    def create_access_token(self, subject: str) -> str: ...
    def create_refresh_token(self, subject: str) -> str: ...
    def decode(self, token: str, *, expected_type: TokenType) -> str:
        """Devuelve el `sub` o lanza AuthError."""


# ---------- Implementaciones por defecto (local) -----------------------------


def _to_bcrypt_bytes(raw: str) -> bytes:
    return raw.encode("utf-8")[:_BCRYPT_MAX_BYTES]


class BcryptPasswordHasher:
    def __init__(self, rounds: int = 12) -> None:
        self._rounds = rounds

    def hash(self, raw: str) -> str:
        salt = bcrypt.gensalt(rounds=self._rounds)
        return bcrypt.hashpw(_to_bcrypt_bytes(raw), salt).decode("ascii")

    def verify(self, raw: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(_to_bcrypt_bytes(raw), hashed.encode("ascii"))
        except ValueError:
            return False


class JwtTokenService:
    def __init__(
        self,
        secret: str,
        algorithm: str,
        access_minutes: int,
        refresh_days: int,
    ) -> None:
        self._secret = secret
        self._alg = algorithm
        self._access_minutes = access_minutes
        self._refresh_days = refresh_days

    def _encode(self, subject: str, token_type: TokenType, delta: timedelta) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": subject,
            "iat": int(now.timestamp()),
            "exp": int((now + delta).timestamp()),
            "type": token_type,
        }
        return jwt.encode(payload, self._secret, algorithm=self._alg)

    def create_access_token(self, subject: str) -> str:
        return self._encode(subject, "access", timedelta(minutes=self._access_minutes))

    def create_refresh_token(self, subject: str) -> str:
        return self._encode(subject, "refresh", timedelta(days=self._refresh_days))

    def decode(self, token: str, *, expected_type: TokenType) -> str:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._alg])
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("Token expired", code="token_expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthError("Invalid token", code="token_invalid") from exc

        if payload.get("type") != expected_type:
            raise AuthError("Wrong token type", code="token_invalid")

        sub = payload.get("sub")
        if not isinstance(sub, str):
            raise AuthError("Invalid token subject", code="token_invalid")
        return sub


# ---------- Factories (singleton-ish, recreables en tests) -------------------


def build_password_hasher() -> PasswordHasher:
    return BcryptPasswordHasher()


def build_token_service() -> TokenService:
    s = get_settings()
    return JwtTokenService(
        secret=s.JWT_SECRET_KEY,
        algorithm=s.JWT_ALGORITHM,
        access_minutes=s.ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_days=s.REFRESH_TOKEN_EXPIRE_DAYS,
    )
