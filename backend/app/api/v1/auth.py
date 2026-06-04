"""Endpoints de autenticación."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.deps import CurrentUser, DbSession, Hasher, TokenSvc
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RefreshRequest, TokenPair
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _service(db: DbSession, hasher: Hasher, tokens: TokenSvc) -> AuthService:
    return AuthService(UserRepository(db), hasher, tokens)


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar usuario",
)
async def register(
    payload: UserCreate,
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
) -> UserRead:
    svc = _service(db, hasher, tokens)
    user = await svc.register(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    await db.commit()
    return UserRead.model_validate(user)


@router.post("/login", response_model=TokenPair, summary="Login con email + password")
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
) -> TokenPair:
    svc = _service(db, hasher, tokens)
    user = await svc.authenticate(email=form.username, password=form.password)
    return svc.issue_tokens(user)


@router.post("/refresh", response_model=TokenPair, summary="Renovar access token")
async def refresh(
    payload: RefreshRequest,
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
) -> TokenPair:
    svc = _service(db, hasher, tokens)
    return await svc.refresh(payload.refresh_token)


@router.get("/me", response_model=UserRead, summary="Usuario autenticado")
async def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
