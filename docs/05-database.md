# 05 — Base de datos y migraciones

PostgreSQL local en Docker. SQLAlchemy 2.0 async como ORM. Alembic gestiona
las migraciones.

---

## Cómo está configurado Alembic

- Modo **async**: `backend/alembic/env.py` usa `async_engine_from_config`.
- Modo **autogenerate**: detecta diferencias entre tus modelos y el esquema
  actual y genera el código de la migración.
- DSN: leído de `Settings.DATABASE_URL` (no de `alembic.ini`), así que basta
  con tu `.env` para que apunte donde toca.
- `compare_type` y `compare_server_default` activados → autogenerate detecta
  cambios reales de tipo y defaults, no solo nombres.

Los modelos se registran en [backend/app/models/\_\_init\_\_.py](../backend/app/models/__init__.py).
Si añades un modelo nuevo, **impórtalo allí** o Alembic no lo verá.

---

## Crear una migración nueva

### 1) Modifica el modelo

Edita o crea el modelo en `backend/app/models/<x>.py`. Si es nuevo, regístralo
en `app/models/__init__.py`.

### 2) Genera la migración

```bash
make migration name="add_products_table"
```

Equivale a:

```bash
cd backend && uv run alembic revision --autogenerate -m "add_products_table"
```

Esto crea `backend/alembic/versions/<timestamp>-<hash>_add_products_table.py`.

### 3) **Revisa siempre el archivo generado**

Autogenerate es muy bueno, pero **no es perfecto**. Cosas que suele saltarse o
detectar mal:

| Detecta bien | Detecta mal o se salta |
|---|---|
| Tablas nuevas | Índices sin nombre custom |
| Columnas nuevas/eliminadas | Renombrados (los ve como drop + add) |
| Tipos básicos (Integer, String, Boolean…) | `CHECK` constraints |
| `NOT NULL` cambios | Cambios de `server_default` complejos |
| Foreign keys nuevas | Datos: no migra **contenido**, solo esquema |

Lee el archivo de arriba abajo. Si una migración hace `drop + add`, casi seguro
es un rename. Edítala a mano:

```python
# en vez de:
op.drop_column("users", "name")
op.add_column("users", sa.Column("full_name", sa.String(255)))

# usa:
op.alter_column("users", "name", new_column_name="full_name")
```

### 4) Aplica

```bash
make migrate
```

Equivale a `uv run alembic upgrade head`.

### 5) Verifica

```bash
docker exec -it app_postgres_dev psql -U app -d app -c "\dt"
# o para una tabla concreta:
docker exec -it app_postgres_dev psql -U app -d app -c "\d products"
```

---

## Ver el estado actual

```bash
cd backend
uv run alembic current        # qué revisión está aplicada
uv run alembic history        # lista de migraciones
uv run alembic heads          # cabeza(s) actuales
```

---

## Rollback

Una revisión hacia atrás:

```bash
cd backend
uv run alembic downgrade -1
```

A una revisión concreta:

```bash
uv run alembic downgrade <revision_id>
```

Vaciar toda la BD:

```bash
uv run alembic downgrade base
```

> ⚠️ El `downgrade` solo es seguro si las funciones `downgrade()` de cada
> migración están bien escritas. Autogenerate las genera, pero compruébalas
> antes de depender de ellas en producción. Para BDs con datos, asume que el
> rollback NO recupera contenido borrado.

---

## Resetear la BD local

Cuando quieres empezar desde cero:

```bash
docker compose -f docker-compose.dev.yml down -v   # borra el volumen
make db-up
make migrate
```

---

## Conectarse a la BD con `psql` o cliente GUI

### Cadena de conexión (desde `.env.example` por defecto)

```
postgresql://app:app@localhost:5432/app
```

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `5432` |
| Usuario | `app` |
| Contraseña | `app` |
| Base de datos | `app` |

### `psql` rápido (sin instalar nada)

```bash
docker exec -it app_postgres_dev psql -U app -d app
```

Comandos útiles dentro de `psql`:

```
\dt              -- lista tablas
\d <tabla>       -- describe una tabla
\du              -- usuarios
\l               -- bases de datos
\x               -- modo expandido (filas verticales)
\q               -- salir
```

### Cliente GUI

Cualquiera funciona — la conexión es Postgres estándar:

| Cliente | Plataforma | Notas |
|---|---|---|
| **TablePlus** | macOS, Windows, Linux | UI ágil, free tier limitada |
| **DBeaver** | macOS, Windows, Linux | Open source, completo |
| **pgAdmin** | Todas | El oficial, más pesado |
| **DataGrip** | macOS, Windows, Linux | JetBrains, de pago |

Conecta con los campos de arriba. SSL: desactivado en local.

---

## Snippets útiles

### Borrar todas las filas de una tabla manteniendo el esquema

```sql
TRUNCATE TABLE items, users RESTART IDENTITY CASCADE;
```

(Resetea también los `SERIAL`/`IDENTITY` a 1.)

### Ver tamaño de tablas

```sql
SELECT
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS total
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Matar conexiones colgadas

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'app' AND pid <> pg_backend_pid();
```

---

## Datos de seed para desarrollo

La plantilla **no** incluye seed por defecto. Si tu producto los necesita, este
es el patrón recomendado:

**1.** Crea `backend/scripts/seed.py`:

```python
"""Crea usuarios y datos de prueba para desarrollo."""

from __future__ import annotations

import asyncio

from app.core.security import build_password_hasher
from app.database import SessionLocal
from app.models.user import User


async def main() -> None:
    hasher = build_password_hasher()
    async with SessionLocal() as db:
        admin = User(
            email="admin@example.com",
            hashed_password=hasher.hash("admin12345"),
            full_name="Admin",
            is_superuser=True,
        )
        db.add(admin)
        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())
```

**2.** Añade un target en el `Makefile`:

```make
seed: ## Datos de prueba para desarrollo
	cd backend && uv run python -m scripts.seed
```

**3.** Úsalo: `make seed` después de `make migrate`.

> ⚠️ Nunca corras seeds en producción. Protégelos con `ENV != "production"` o
> con un input explícito si hace falta.

---

## En producción

El `entrypoint.sh` del contenedor corre `alembic upgrade head` al arrancar por
defecto. Esto está bien para empezar, pero en K8s con varios pods compitiendo
es mejor desactivarlo y usar un Job/InitContainer dedicado:

- En el Deployment, pon `RUN_MIGRATIONS=0` como env var.
- Crea un Job que corra `alembic upgrade head` antes del rollout.

Habla con DevOps cuando llegues a ese punto.

---

## Siguiente paso

- Escribir tests que tocan la BD → [06-testing](06-testing.md#integration-tests).
- Añadir un endpoint con su modelo → [04-writing-endpoints](04-writing-endpoints.md).
