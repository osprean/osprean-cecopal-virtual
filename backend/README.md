# Backend — FastAPI

Servicio FastAPI async con SQLAlchemy 2.0, Alembic y auth JWT local.

## Setup local

```bash
cd backend
uv sync
cp ../.env.example ../.env   # ajusta secretos
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Requiere PostgreSQL corriendo (`make db-up` desde la raíz).

## Comandos clave

| Acción | Comando |
|---|---|
| Tests | `uv run pytest` |
| Coverage | `uv run pytest --cov=app --cov-report=term-missing` |
| Lint | `uv run ruff check .` |
| Format | `uv run ruff format .` |
| Type-check | `uv run mypy app` |
| Migración nueva | `uv run alembic revision --autogenerate -m "msg"` |
| Aplicar migraciones | `uv run alembic upgrade head` |

## Layout

```
app/
├── main.py              # FastAPI + SPA fallback en producción
├── config.py            # Settings vía pydantic-settings
├── database.py          # Engine async + Base + session factory
├── deps.py              # get_current_user, get_session, etc.
├── core/
│   ├── security.py      # PasswordHasher, TokenService (Protocols → swappable)
│   ├── logging.py       # structlog JSON
│   └── exceptions.py    # AppError + handlers
├── api/
│   ├── health.py
│   ├── router.py
│   └── v1/{auth,users,items}.py
├── models/              # SQLAlchemy
├── schemas/             # Pydantic
├── repositories/        # acceso a datos
└── services/            # business logic
```

## Swap a Keycloak/Authentik

`core/security.py` define `TokenService` y `PasswordHasher` como `Protocol`s.
Para migrar a un IdP externo:

1. Implementar un nuevo `TokenService` que valide tokens del IdP (JWKS).
2. Sustituir `build_token_service()` en `deps.py` (o usar `dependency_overrides`).
3. Quitar `/auth/register` y `/auth/login`; el frontend redirige al IdP.

Los endpoints protegidos (`/me`, `/items`...) no requieren cambios.
