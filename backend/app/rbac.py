"""RBAC: dependencia require_perm para proteger endpoints por permiso.

Se resuelven los permisos desde los roles ACTIVOS del principal
(cecovi_rol_seleccion), nunca por comparación de rol. Para mutaciones
(`write=True`) además se exige que el principal no esté en solo lectura (I3).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.core.exceptions import ForbiddenError
from app.core.permissions import permisos_de_roles
from app.deps import DbSession
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.repositories.rol_seleccion_repository import RolSeleccionRepository
from app.tenancy import Principal


async def active_roles(db: DbSession, principal: CecoviUsuarioTemporal) -> list[str]:
    rows = await RolSeleccionRepository(db).list_for_usuario(
        emergencia_id=principal.emergencia_id, usuario_temporal_id=principal.id
    )
    return [r.rol for r in rows if r.activo]


def require_perm(
    perm: str, *, write: bool = False
) -> Callable[[CecoviUsuarioTemporal, DbSession], Awaitable[CecoviUsuarioTemporal]]:
    """Devuelve una dependencia que exige `perm` y, si write, no-solo-lectura.

    La dependencia cuelga de `Principal` (que ya impuso 404→403→principal) y
    devuelve el principal para que el endpoint lo use.
    """

    async def _dep(principal: Principal, db: DbSession) -> CecoviUsuarioTemporal:
        roles = await active_roles(db, principal)
        if perm not in permisos_de_roles(roles):
            raise ForbiddenError("Permiso insuficiente", code="forbidden_perm")
        if write and principal.solo_lectura:
            raise ForbiddenError("Nivel en solo lectura", code="solo_lectura")
        return principal

    return _dep
