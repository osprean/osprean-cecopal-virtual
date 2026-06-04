"""Selección de roles en el primer acceso (I4).

- Catálogo: roles seleccionables (el jefe NO se elige, se designa al crear).
- Selección: libre (uno o varios) en el primer acceso; una vez confirmada, es
  INMUTABLE a nivel de servicio (rechaza cambios con 409), no solo en la UI.
"""

from __future__ import annotations

from app.core.exceptions import AppError, ConflictError
from app.core.roles import ROLES_SELECCIONABLES
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.repositories.log_repository import LogRepository
from app.repositories.rol_seleccion_repository import RolSeleccionRepository


class RolesService:
    def __init__(self, *, roles: RolSeleccionRepository, logs: LogRepository) -> None:
        self._roles = roles
        self._logs = logs

    @staticmethod
    def catalogo() -> list[str]:
        return list(ROLES_SELECCIONABLES)

    async def seleccionar(self, *, usuario: CecoviUsuarioTemporal, roles: list[str]) -> list[str]:
        if usuario.roles_confirmados:
            # I4: inmutable tras confirmar (incluye al jefe, ya confirmado al crear).
            raise ConflictError(
                "La selección de roles ya está confirmada y es inmutable",
                code="roles_inmutables",
            )

        pedidos = list(dict.fromkeys(roles))  # dedup conservando orden
        invalidos = [r for r in pedidos if r not in ROLES_SELECCIONABLES]
        if invalidos:
            raise AppError(
                f"Roles no seleccionables: {', '.join(invalidos)}",
                code="rol_no_seleccionable",
            )

        for rol in pedidos:
            await self._roles.add(
                emergencia_id=usuario.emergencia_id,
                usuario_temporal_id=usuario.id,
                rol=rol,
            )
        usuario.roles_confirmados = True

        await self._logs.add(
            emergencia_id=usuario.emergencia_id,
            accion="roles_seleccionados",
            actor_usuario_id=usuario.id,
            payload={"roles": pedidos},
        )
        return pedidos
