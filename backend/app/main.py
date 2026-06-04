"""Entry point FastAPI.

En producción sirve también los estáticos del frontend buildeado
para que un producto = una imagen Docker = un pod.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.router import api_router
from app.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger

_EXCLUDED_FROM_SPA: tuple[str, ...] = (
    "/api",
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/assets",
    "/favicon.ico",
)


def _create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    log = get_logger(__name__)

    app = FastAPI(
        title="CECOVI (CECOPAL Virtual)",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    if settings.CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        req_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=req_id,
            method=request.method,
            path=request.url.path,
        )
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("request_failed")
            raise
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            log.info(
                "request_completed",
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
            response.headers["X-Request-ID"] = req_id
            return response

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(api_router)

    _mount_frontend(app, settings.FRONTEND_DIST_PATH, log)

    return app


def _mount_frontend(
    app: FastAPI,
    dist_path_str: str,
    log: structlog.stdlib.BoundLogger,
) -> None:
    """Solo en producción y solo si existe el bundle."""
    if not get_settings().is_production:
        log.info("frontend_static_disabled", reason="non_production")
        return

    dist = Path(dist_path_str)
    if not dist.exists():
        log.warning("frontend_dist_missing", path=str(dist))
        return

    assets_dir = dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    index_file = dist / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        # Routers de API ya respondieron antes; aquí solo cae lo no matcheado.
        if any(("/" + full_path).startswith(prefix) for prefix in _EXCLUDED_FROM_SPA):
            # FastAPI no llegará aquí para esos prefijos salvo que el path no exista;
            # devolver index.html en esos casos sería incorrecto.
            return FileResponse(index_file, status_code=404)
        return FileResponse(index_file)

    log.info("frontend_static_mounted", path=str(dist))


app = _create_app()
