---
name: add-role
description: Procedimiento para añadir un rol/vista nuevo de CECOVI de forma consistente en backend y frontend (catálogo de permisos, dependencia RBAC, vista por rol, guardas). Tarea manual; no la auto-invoca el modelo.
disable-model-invocation: true
---

# Añadir un rol/vista nuevo en CECOVI

Sigue estos pasos para que un rol quede coherente en back y front y **respete los invariantes** ([[cecovi-invariants]]). Un rol = un conjunto de permisos + una vista/área operativa. Recuerda I4 (la selección de roles del usuario es inmutable) e I1 (no toques el rol "jefe").

## Backend
1. **Catálogo de permisos** (`backend/app/core/permissions.py`): añade las claves `area:accion` nuevas (p. ej. `seguridad:cierre_via`). No reutilices claves de otra área.
2. **Definición del rol** (`backend/app/core/roles.py` o seed en migración): nombre estable (`seguridad`, `sanitario`, `logistica`, `gabinete`, `campo`, `direccion`/jefe…) + lista de permisos. El rol **jefe** se gestiona aparte (permisos totales, único por emergencia — no lo dupliques).
3. **Dependencia RBAC**: protege endpoints con `require_perm("area:accion")` (no con `if role == ...`). Ver [[osprean-stack]].
4. **Modelo/seed**: si el rol es seleccionable en el primer acceso, regístralo en el catálogo que devuelve el endpoint de selección de roles. Migración solo en tablas `cecovi_*` ([[db-migration]]).
5. **Tests**: integración que verifique 403 sin permiso y 200 con permiso, y que la **selección quede inmutable** tras confirmar.

## Frontend
6. **Permisos en cliente**: añade las claves al tipado de permisos (`frontend/src/types/auth.ts`).
7. **Vista**: crea la página/área del rol en `frontend/src/pages/<rol>/` (usa emergency-manager como referencia de UI). Regístrala en el router por `/{idEmergencia}/...`.
8. **Guardas**: oculta vista/acciones según permisos de `/auth/me`. La guarda de cliente es UX; **el backend reimpone** (defensa en profundidad).
9. **Selección de roles**: si es elegible en primer acceso, añádelo a la pantalla de selección con su descripción.

## Checklist
- [ ] Permisos nuevos en catálogo back y tipos front.
- [ ] Endpoints protegidos por `require_perm`, no por comparación de rol.
- [ ] No se altera la unicidad del jefe (I1) ni la inmutabilidad de roles (I4).
- [ ] Vista enrutada bajo `/{idEmergencia}` y filtrada por `emergencia_id` (I6).
- [ ] Tests de permiso (403/200) verdes.
