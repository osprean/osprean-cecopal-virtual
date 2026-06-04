"""Composición de routers bajo /api/v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    auth,
    direccion,
    emergencias,
    items,
    logistica,
    recursos,
    sanitario,
    seguridad,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(items.router)
api_router.include_router(emergencias.router)
api_router.include_router(recursos.router)
api_router.include_router(seguridad.router)
api_router.include_router(direccion.router)
api_router.include_router(sanitario.router)
api_router.include_router(logistica.router)
