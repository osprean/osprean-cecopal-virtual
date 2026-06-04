# CECOVI (CECOPAL Virtual)

Plataforma web de **gestión de una emergencia en curso**. Se integra con **COMACON** (núcleo: antes/después de la emergencia) sobre una **base de datos PostgreSQL compartida**: CECOVI tiene tablas propias (`cecovi_*`) y lee/edita los recursos de COMACON como **referencia viva** (sin copia ni export/import).

> COMACON y CECOVI son nombres provisionales.

## Stack

Monorepo **FastAPI** (async, SQLAlchemy 2.0 + asyncpg + Alembic) + **React/Vite** servido por FastAPI en producción. **PostgreSQL/PostGIS** compartida con COMACON. Despliegue **Kubernetes**, instancia **siempre activa**. Auth **JWT local** con abstracción (`Protocol`) para un IdP futuro. Scaffold derivado de `osprean-webapp-template`; convenciones en [.claude/skills/osprean-stack](.claude/skills/osprean-stack/SKILL.md).

## Invariantes de corrección

Ver [.claude/skills/cecovi-invariants](.claude/skills/cecovi-invariants/SKILL.md): **mando único** por emergencia, **continuidad de mando** en la transferencia, **roles inmutables**, **aislamiento por `emergencia_id`**, **auditoría inmutable**, **plataforma siempre activa**.

## Acceso a la DB compartida

CECOVI **solo migra** tablas `cecovi_*`. Alembic está aislado en [backend/alembic/env.py](backend/alembic/env.py): `version_table = alembic_version_cecovi` e `include_object` que filtra por el prefijo `cecovi_`, de modo que el autogenerate **nunca** toca el esquema de COMACON aunque viva en la misma base. Reglas en [.claude/skills/comacon-db-access](.claude/skills/comacon-db-access/SKILL.md) y [.claude/skills/db-migration](.claude/skills/db-migration/SKILL.md).

## Desarrollo

```bash
cp .env.example .env        # editar JWT_SECRET_KEY y DATABASE_URL (DB compartida)
make install                # backend (uv) + frontend (pnpm)
make db-up                  # PostgreSQL local
make migrate                # alembic upgrade head (solo cecovi_*)
make backend-dev            # FastAPI :8000 (/docs)
make frontend-dev           # Vite :5173 (proxy /api → :8000)
```

## Estado

Scaffold inicial (**F0** del roadmap): plantilla copiada y renombrada, Alembic aislado. Los modelos/migraciones de ejemplo de la plantilla (`user`, `item`) son herencia y **se sustituyen por las tablas `cecovi_*` en F1** (no deben aplicarse contra la DB compartida tal cual). Documentación de la plantilla en [docs/](docs/).
