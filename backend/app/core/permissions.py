"""Catálogo centralizado de permisos RBAC de CECOVI.

Claves `area:accion`. Los endpoints se protegen con `require_perm("area:accion")`
(ver app/rbac.py), NUNCA con `if rol == ...`. Los permisos se resuelven desde
los roles activos del usuario (cecovi_rol_seleccion). El jefe tiene todos.

El front oculta por rol; el backend reimpone (defensa en profundidad). Para
añadir un rol/área, ver la skill `add-role`.
"""

from __future__ import annotations

from app.core.roles import ROL_JEFE, ROLES_SELECCIONABLES

# --- permisos transversales ---
RECURSOS_VER = "recursos:ver"  # lectura de recursos de COMACON (solo lectura)
LOGS_VER = "logs:ver"  # consulta del historial/auditoría


# --- permisos por área operativa ---
# Convención: "{area}:ver" (lectura) y "{area}:operar" (mutaciones).
def _ver(area: str) -> str:
    return f"{area}:ver"


def _operar(area: str) -> str:
    return f"{area}:operar"


# Permisos por rol seleccionable (cada rol = su área + lectura de recursos).
ROLE_PERMISSIONS: dict[str, set[str]] = {
    rol: {_ver(rol), _operar(rol), RECURSOS_VER} for rol in ROLES_SELECCIONABLES
}

# Conjunto total (lo que tiene el jefe).
ALL_PERMS: frozenset[str] = frozenset(
    {RECURSOS_VER, LOGS_VER}
    | {p for perms in ROLE_PERMISSIONS.values() for p in perms}
    # dirección es el área del jefe (no es rol seleccionable).
    | {_ver("direccion"), _operar("direccion")}
)


def permisos_de_roles(roles: list[str]) -> frozenset[str]:
    """Permisos efectivos. P3: `direccion` (alcalde) y `jefe` tienen TODO.

    `jefe` se conserva por compat con cecovi_rol_seleccion legacy; `direccion`
    es el rol que viaja ahora en el JWT del master del área Dirección.
    """
    if ROL_JEFE in roles or "direccion" in roles:
        return ALL_PERMS
    perms: set[str] = set()
    for rol in roles:
        perms |= ROLE_PERMISSIONS.get(rol, set())
    # Todos los autenticados pueden leer recursos de COMACON.
    perms.add(RECURSOS_VER)
    return frozenset(perms)
