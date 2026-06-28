"""RBAC: dependencia require_perm para proteger endpoints por permiso.

Cambios P3: los roles se LEEN DEL JWT (no de `cecovi_rol_seleccion`), porque la
credencial es la unidad de acceso. Eso permite credenciales con roles compuestos
(D4) sin sincronizar tablas en cada cambio.

Para mutaciones (`write=True`) se exige además que el principal (usuario temporal,
si lo hay) no esté en `solo_lectura` (I3).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.core.exceptions import ForbiddenError
from app.core.permissions import permisos_de_roles
from app.deps import DbSession
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository
from app.tenancy import SessionCtx, SessionDep


def require_perm(
    perm: str, *, write: bool = False
) -> Callable[[SessionCtx, DbSession], Awaitable[SessionCtx]]:
    """Devuelve una dependencia que exige `perm` y, si write, no-solo-lectura.

    La dependencia cuelga de `SessionDep` (que ya validó token + sesión activa +
    emergencia coincidente) y devuelve el contexto de sesión.
    """

    async def _dep(session: SessionDep, db: DbSession) -> SessionCtx:
        if perm not in permisos_de_roles(session.roles):
            raise ForbiddenError("Permiso insuficiente", code="forbidden_perm")
        if write and session.usuario_id is not None:
            # Comprobar solo_lectura del usuario nominado.
            usuario = await UsuarioTemporalRepository(db).get_in_emergencia(
                emergencia_id=session.emergencia_id, usuario_id=session.usuario_id
            )
            if usuario is not None and usuario.solo_lectura:
                raise ForbiddenError("Nivel en solo lectura", code="solo_lectura")
        return session

    return _dep
