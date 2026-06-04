"""Resolución de la ruta /{idEmergencia} y endpoints acotados a una emergencia.

Punto de entrada del enrutado por path = identificador de emergencia. El
contexto de tenancy (`EmergenciaCtx`) impone 404 (slug inexistente) y 403 (sin
credencial válida) antes de exponer nada. La creación de emergencias y el login
con credencial temporal son F2; aquí solo vive el resolver.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.emergencia import EmergenciaRead
from app.tenancy import EmergenciaCtx

router = APIRouter(prefix="/emergencias", tags=["emergencias"])


@router.get(
    "/{id_emergencia}",
    response_model=EmergenciaRead,
    summary="Resolver una emergencia por su slug de ruta",
)
async def get_emergencia(emergencia: EmergenciaCtx) -> EmergenciaRead:
    # Si llegamos aquí, el slug existe (si no, 404) y hay credencial válida para
    # esta emergencia (si no, 403). El objeto ya está acotado al tenant.
    return EmergenciaRead.model_validate(emergencia)
