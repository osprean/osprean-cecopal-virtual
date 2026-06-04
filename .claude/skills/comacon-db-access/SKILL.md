---
name: comacon-db-access
description: Reglas para acceder a la base de datos PostgreSQL compartida con COMACON desde CECOVI — qué tablas son de COMACON (organization, usuario, inventory_element/resource, escalation_*, phone_directory_entries) vs propias de CECOVI, frontera de escritura, aislamiento por emergencia_id y control de concurrencia/integridad. Consúltala SIEMPRE que se lea o edite un recurso de COMACON o se diseñe una query que cruce productos.
---

# Acceso a la base de datos compartida con COMACON

CECOVI y COMACON comparten una sola base PostgreSQL (PostGIS, db `comacon`). COMACON es **dueño del esquema**; CECOVI **lee y edita** sus recursos como **referencia viva** (sin copia, sin export/import) y **añade tablas propias**.

## Mapa de propiedad de tablas

**De COMACON (no las migra CECOVI; solo lectura del esquema):**
- `organization` (id, name, owner_user_id) — raíz multi-tenant.
- `usuario` — identidades COMACON. RBAC: `role` (permisos JSONB), `user_role`, `user_permission_override`, `permission_audit_log`.
- Recursos: `inventory_element` (base, `organization_id`) → `resource` + subtipos (`human_resource`, `transport_resource`, `logistic_resource`, `road_infrastructure`…), `resource_category/group/type`.
- Contactos/escalado: `escalation_list`, `escalation_step`, `escalation_contact`, `phone_directory_entries`.
- Incidentes COMACON: `emergencies`, `emergencylocation` (¡distintos de la entidad emergencia de CECOVI!).

**Propias de CECOVI** (prefijo `cecovi_`, las migra CECOVI): `cecovi_emergencia`, `cecovi_usuario_temporal`, `cecovi_credencial`, `cecovi_rol_seleccion`, `cecovi_transferencia`, `cecovi_log` (auditoría), `cecovi_recurso_override`.

## Reglas duras

1. **Migraciones**: las migraciones de CECOVI **NUNCA** crean, alteran o borran tablas/columnas de COMACON. Solo crean tablas `cecovi_*`. Alembic de CECOVI usa una `version_table` propia (`alembic_version_cecovi`) y filtra objetos por prefijo. Ver [[db-migration]].
2. **Frontera de escritura (write boundary)**: CECOVI **no escribe directamente** columnas de COMACON salvo una *allowlist* explícita por tabla/columna. Lo prohibido por defecto:
   - No borra filas de COMACON (ni hard ni cascada).
   - No cambia FKs estructurales (`organization_id`, jerarquías de `resource_*`).
   - Lo "vivo" que sí puede tocar (allowlist): campos operativos de estado/ubicación de recursos (`inventory_element.status`, `localization`, `observations`) **a través de una capa de servicio**, nunca con UPDATE crudo disperso.
   - Toda mutación sobre COMACON se registra en `cecovi_log` (I7) y, si aplica, en `permission_audit_log`.
3. **Aislamiento por emergencia (I6)**: cualquier dato operativo propio se referencia por `cecovi_emergencia.id`. Una emergencia de CECOVI pertenece a una `organization` de COMACON (`cecovi_emergencia.organization_id`). Las queries de recursos se acotan por `organization_id` de la emergencia.
4. **Concurrencia/integridad** (COMACON **no** tiene columna de versión ni soft-delete):
   - Edición optimista: leer `updated_at`, escribir con `WHERE id=? AND updated_at=?`; si 0 filas afectadas → conflicto 409, recargar.
   - Para secciones críticas que crucen ambos productos, usar `pg_advisory_xact_lock(hashtext('comacon_resource:'||id))`.
   - Mantener transacciones cortas; no abrir transacción mientras se espera input de usuario.
5. **Sesiones separadas**: CECOVI usa su propio engine/pool (asyncpg) apuntando a la misma DB; no comparte sesión con el proceso Flask de COMACON.

## Antipatrones a rechazar
- `DELETE`/`TRUNCATE` sobre tablas COMACON.
- `ALTER TABLE` de COMACON en una migración de CECOVI.
- UPDATE de COMACON fuera de la capa de servicio con allowlist.
- Query operativa sin `emergencia_id`/`organization_id`.

Relacionado: [[cecovi-invariants]] (I6, I7), [[db-migration]] (cómo migrar solo lo propio), [[osprean-stack]] (capa de servicio/repos).
