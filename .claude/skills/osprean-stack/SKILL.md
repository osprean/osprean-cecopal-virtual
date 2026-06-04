---
name: osprean-stack
description: Convenciones del monorepo FastAPI + React de la plantilla osprean-webapp-template sobre el que se construye CECOVI — estructura de carpetas, capas (model/repository/service/schema/router), patrón JWT swappable, dónde y cómo se materializa el RBAC, naming, Alembic, Docker/k8s y el flujo canónico para añadir un módulo. Consúltala al crear endpoints, modelos, vistas o al tocar auth.
---

# Stack y convenciones del monorepo (plantilla osprean)

CECOVI parte de `osprean-webapp-template` copiada sobre el repo. Backend FastAPI **async** (SQLAlchemy 2.0 + asyncpg + Alembic), frontend React 18 + Vite servido por FastAPI en prod. Un contenedor, despliegue k8s siempre activo.

## Estructura backend (`backend/app/`)
- `main.py` — app factory, middleware, handlers, sirve `frontend/dist` en prod.
- `config.py` — `Settings` con pydantic-settings (env > .env > defaults).
- `database.py` — AsyncEngine, `SessionLocal`, dependencia `get_session`.
- `deps.py` — `DbSession`, `CurrentUser`, servicios inyectables.
- `core/security.py` — JWT (`JwtTokenService`) y hashing (`BcryptPasswordHasher`), **ambos como `Protocol`** → swappables por un IdP futuro sin tocar el resto.
- `core/exceptions.py` — `AppError`/`NotFoundError`/`ConflictError`/`AuthError`/`ForbiddenError` + handlers.
- `api/router.py` → compone routers bajo `/api/v1`; `api/health.py` (probes k8s `/health/live`,`/health/ready`).
- Capas: `models/` (SQLAlchemy 2.0 `Mapped[...]`) → `repositories/` (solo queries) → `services/` (reglas de negocio, checks de propiedad/permiso) → `schemas/` (Pydantic v2, `from_attributes=True`) → `api/v1/*` (solo HTTP).

## Flujo canónico para añadir un módulo
1. `models/<x>.py` + importarlo en `models/__init__.py` (para autogenerate de Alembic).
2. `schemas/<x>.py` (Create/Read, validaciones con `Field`).
3. `make migration name="add_<x>"` → revisar a mano → `make migrate`. Ver [[db-migration]] (CECOVI: version_table propia, solo tablas `cecovi_*`).
4. `repositories/<x>_repository.py` (queries puras) → `services/<x>_service.py` (reglas) → `api/v1/<x>.py` (`APIRouter(prefix=..., tags=...)`, `db: DbSession`, `current_user: CurrentUser`, `await db.commit()`).
5. Registrar router en `api/router.py`.
6. Test de integración en `tests/integration/`; verificar en `/docs`.

## RBAC en CECOVI (extensión del template)
El template solo trae `is_superuser`/`is_active` + checks de propiedad en servicios. CECOVI añade RBAC por emergencia:
- Dependencia `require_perm("perm:key")` y `require_role(...)` construida sobre `CurrentUser`, que resuelve permisos desde la selección de roles de la emergencia activa (tablas `cecovi_*`).
- El `emergencia_id` viaja en el claim del JWT temporal y/o en el path; toda dependencia de datos lo aplica (I6). Ver [[cecovi-invariants]].
- La escritura sobre recursos COMACON pasa por la capa de servicio con allowlist. Ver [[comacon-db-access]].

## Auth / JWT
- `POST /api/v1/auth/login` (OAuth2PasswordRequestForm) → access+refresh. En CECOVI el "login" usa **credencial temporal** (ver diseño): el subject es el `cecovi_usuario_temporal`, el claim incluye `emergencia_id`.
- `get_current_user` decodifica access, valida tipo y `is_active`.

## Frontend (`frontend/src/`)
- `api/client.ts` (axios, interceptor de auth + refresh en 401), `components/AuthProvider.tsx`, `ProtectedRoute.tsx`, `pages/`, TanStack Query, React Router.
- CECOVI: enrutado por `/{idEmergencia}`, guardas por rol que leen permisos del `/auth/me`. El RBAC se materializa ocultando vistas/acciones **y** el backend lo reimpone (defensa en profundidad).

## Build/deploy
- `docker/Dockerfile` multi-stage (frontend → backend → runtime no-root). `entrypoint.sh` corre `alembic upgrade head` si `RUN_MIGRATIONS=1`.
- Vite dev proxy `:5173 → :8000`. Makefile: `install`, `db-up`, `backend-dev`, `frontend-dev`, `migrate`, `migration name=`, `test`, `lint`, `build`.

## Renombrado de plantilla → CECOVI
`backend/pyproject.toml` name, `frontend/package.json` name, `docker/Dockerfile` imagen, `Makefile` IMAGE_NAME, `.env.example`, `main.py` title, `README.md`.

Relacionado: [[cecovi-invariants]], [[comacon-db-access]], [[db-migration]], [[add-role]].
