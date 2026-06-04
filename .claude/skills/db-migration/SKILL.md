---
name: db-migration
description: Cómo crear y migrar las tablas EXCLUSIVAS de CECOVI (cecovi_emergencia, cecovi_usuario_temporal, cecovi_credencial, cecovi_log…) con Alembic sobre la base compartida con COMACON, SIN tocar el esquema de COMACON. Úsala al añadir/alterar tablas o al generar revisiones de Alembic.
---

# Migraciones de CECOVI sobre la base compartida

CECOVI comparte la base con COMACON pero **solo migra sus tablas `cecovi_*`**. COMACON es dueño de su esquema y de su propia cadena de Alembic. Reglas en [[comacon-db-access]].

## Regla de oro
Una migración de CECOVI **NUNCA** crea/altera/borra tablas o columnas de COMACON (`organization`, `usuario`, `role`, `inventory_element`, `resource*`, `escalation_*`, `emergencies`, …). Si una revisión autogenerada propone tocarlas, **es un error**: edítala.

## Aislamiento de la cadena Alembic
- `version_table = "alembic_version_cecovi"` (distinto del de COMACON) en `alembic/env.py`.
- `include_object` que **excluya** todo objeto que no empiece por `cecovi_` (y excluya `spatial_ref_sys`, tablas PostGIS). Así autogenerate ignora el esquema COMACON aunque esté en la misma DB:
  ```python
  def include_object(obj, name, type_, reflected, compare_to):
      if type_ == "table":
          return name.startswith("cecovi_")
      return True  # columnas/índices de tablas cecovi_*
  ```
- `target_metadata` solo incluye los modelos `cecovi_*` (todos importados en `models/__init__.py`).

## Flujo
1. Define/edita el modelo en `backend/app/models/<x>.py` con `__tablename__ = "cecovi_<x>"` y `emergencia_id` (FK a `cecovi_emergencia.id`) si es operativo (I6, [[cecovi-invariants]]).
2. `make migration name="add_cecovi_<x>"`.
3. **Revisa a mano** la revisión: confirma que solo toca `cecovi_*`, que las FK a tablas COMACON usan `ForeignKey("organization.id")`/`usuario.id` **sin** redefinir esas tablas, y que índices/constraints (p. ej. único parcial del jefe activo) están presentes.
4. `make migrate` (o `alembic upgrade head`). En k8s lo corre el `entrypoint.sh` si `RUN_MIGRATIONS=1`.

## Patrones específicos de CECOVI
- **FK cruzada a COMACON**: `mapped_column(ForeignKey("organization.id"))` — referencia, no posesión. No pongas `ondelete` que borre datos COMACON.
- **Unicidad del jefe (I1)**: índice único parcial, p. ej.
  `Index("uq_jefe_activo", "emergencia_id", unique=True, postgresql_where=text("rol='jefe' AND activo"))`.
- **Auditoría inmutable (I7)**: `cecovi_log` append-only; no definir rutas de UPDATE/DELETE. Considerar trigger/`REVOKE` o regla de solo-insert.
- **Archivado en cierre (I8)**: usar columnas de estado (`estado`, `archivada_at`), no DROP de tablas.
- **Tipos**: timestamps `DateTime(timezone=True)` con `server_default=func.now()`; geometría con geoalchemy2 SRID 4326 si se reutiliza el patrón COMACON.

## Checklist
- [ ] `__tablename__` con prefijo `cecovi_`.
- [ ] Revisión Alembic NO toca tablas COMACON.
- [ ] `version_table` e `include_object` aislados.
- [ ] FK a COMACON sin cascada destructiva.
- [ ] `emergencia_id` presente en tablas operativas.
