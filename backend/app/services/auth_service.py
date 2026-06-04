"""Lógica de auth: registro, login, refresh."""

from __future__ import annotations

from app.core.exceptions import AuthError, ConflictError
from app.core.security import PasswordHasher, TokenService
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(
        self,
        users: UserRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
    ) -> None:
        self._users = users
        self._hasher = hasher
        self._tokens = tokens

    async def register(
        self,
        *,
        email: str,
        password: str,
        full_name: str | None,
    ) -> User:
        existing = await self._users.get_by_email(email)
        if existing is not None:
            raise ConflictError("Email already registered", code="email_taken")
        return await self._users.create(
            email=email,
            hashed_password=self._hasher.hash(password),
            full_name=full_name,
        )

    async def authenticate(self, *, email: str, password: str) -> User:
        user = await self._users.get_by_email(email)
        if user is None or not self._hasher.verify(password, user.hashed_password):
            raise AuthError("Invalid credentials", code="bad_credentials")
        if not user.is_active:
            raise AuthError("User inactive", code="user_inactive")
        return user

    def issue_tokens(self, user: User) -> TokenPair:
        sub = str(user.id)
        return TokenPair(
            access_token=self._tokens.create_access_token(sub),
            refresh_token=self._tokens.create_refresh_token(sub),
        )

    async def refresh(self, refresh_token: str) -> TokenPair:
        sub = self._tokens.decode(refresh_token, expected_type="refresh")
        try:
            user_id = int(sub)
        except ValueError as exc:
            raise AuthError("Invalid subject", code="token_invalid") from exc
        user = await self._users.get_by_id(user_id)
        if user is None or not user.is_active:
            raise AuthError("User inactive", code="user_inactive")
        return self.issue_tokens(user)
