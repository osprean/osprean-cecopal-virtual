"""Excepciones de dominio + handlers FastAPI."""

from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

log = get_logger(__name__)


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "app_error"

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        extra: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.extra: dict[str, object] = extra or {}
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class AuthError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "forbidden"


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    log.warning(
        "app_error",
        path=request.url.path,
        code=exc.code,
        message=exc.message,
    )
    payload: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.extra:
        payload.update(exc.extra)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": payload},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
