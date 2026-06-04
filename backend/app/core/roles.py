"""Catálogo de roles de CECOVI.

`rol` se persiste como STRING (no enum de DB): el conjunto es extensible. El
jefe NO es seleccionable: se designa al crear la emergencia (mitad "nunca cero"
de I1). El resto de roles los elige libremente el concejal en su primer acceso
(I4) y, una vez confirmados, son inmutables. Ver skill `cecovi-invariants` y,
para añadir roles, la skill `add-role`.
"""

from __future__ import annotations

ROL_JEFE = "jefe"

# Roles operativos elegibles por los concejales (alineados con las áreas del
# gestor de emergencia: emergency-manager).
ROLES_SELECCIONABLES: tuple[str, ...] = (
    "seguridad",
    "sanitario",
    "logistica",
    "gabinete",
    "campo",
)
