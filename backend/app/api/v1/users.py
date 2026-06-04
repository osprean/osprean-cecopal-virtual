"""Endpoints de usuarios (mínimo, ampliable)."""

from __future__ import annotations

from fastapi import APIRouter

from app.deps import CurrentUser
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead, summary="Alias de /auth/me")
async def read_me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)
