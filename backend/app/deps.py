"""Dependencies compartidas."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError
from app.core.security import (
    PasswordHasher,
    TokenService,
    build_password_hasher,
    build_token_service,
)
from app.database import get_session
from app.models.user import User
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_session)]


def get_token_service() -> TokenService:
    return build_token_service()


def get_password_hasher() -> PasswordHasher:
    return build_password_hasher()


TokenSvc = Annotated[TokenService, Depends(get_token_service)]
Hasher = Annotated[PasswordHasher, Depends(get_password_hasher)]


async def get_current_user(
    db: DbSession,
    tokens: TokenSvc,
    token: Annotated[str | None, Depends(oauth2_scheme)],
) -> User:
    if not token:
        raise AuthError("Missing credentials", code="missing_token")
    subject = tokens.decode(token, expected_type="access")
    try:
        user_id = int(subject)
    except ValueError as exc:
        raise AuthError("Invalid subject", code="token_invalid") from exc

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthError("User not found or inactive", code="user_inactive")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
