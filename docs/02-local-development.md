# 02 — Desarrollo local

Cómo es el día a día con la plantilla: qué corre dónde, qué comandos usar y en
qué orden.

---

## Arquitectura local: tres piezas hablando

```
┌─────────────────────────┐   /api/*    ┌───────────────────────┐
│  Vite dev server        │ ──────────► │  FastAPI (uvicorn)    │
│  localhost:5173         │   (proxy)   │  localhost:8000       │
│  HMR del frontend       │             │  Hot reload por archivo│
└─────────────────────────┘             └───────────┬───────────┘
                                                    │ asyncpg
                                                    ▼
                                        ┌───────────────────────┐
                                        │  PostgreSQL 16        │
                                        │  localhost:5432       │
                                        │  (Docker)             │
                                        └───────────────────────┘
```

- Tu navegador habla con **Vite** en `:5173`.
- Vite proxea todo lo que empieza por `/api` a **FastAPI** en `:8000`. Eso
  evita problemas de CORS en desarrollo.
- FastAPI habla con **Postgres** en `:5432` vía asyncpg.

En producción Vite no existe: FastAPI sirve el bundle estático y la API desde
el mismo origen. Un único pod.

---

## Comandos cotidianos del Makefile

`make help` te lista todos en cualquier momento. Resumen:

| Comando | Qué hace |
|---|---|
| `make install` | `uv sync` (backend) + `pnpm install` (frontend) |
| `make db-up` | Arranca Postgres en Docker |
| `make db-down` | Para Postgres |
| `make db-logs` | Sigue los logs de Postgres |
| `make migrate` | Aplica migraciones pendientes (alembic upgrade head) |
| `make migration name="add_foo"` | Genera migración con autogenerate |
| `make backend-dev` | Uvicorn con `--reload` en `:8000` |
| `make frontend-dev` | Vite dev server en `:5173` |
| `make test` | pytest + vitest |
| `make test-cov` | pytest con coverage |
| `make lint` | ruff check + ruff format --check + eslint + prettier check |
| `make format` | ruff format + prettier (modifica) |
| `make typecheck` | mypy + tsc |
| `make build` | Construye imagen Docker (`osprean-webapp:local`) |
| `make clean` | Borra `.venv`, `node_modules`, caches, dist |

---

## Orden recomendado al empezar el día

```bash
git pull --rebase                 # 1. Sincroniza
make install                      # 2. Si alguien añadió deps
make db-up                        # 3. Postgres en background
make migrate                      # 4. Si hay nuevas migraciones
make backend-dev                  # 5. Una terminal
make frontend-dev                 # 6. Otra terminal
```

Pasos 2 y 4 son no-op si no hay cambios; cuestan poco lanzarlos por costumbre.

---

## Parar todo limpiamente

- `Ctrl+C` en cada terminal de dev (backend y frontend).
- `make db-down` para parar Postgres (los datos quedan en el volumen).

Para liberar completamente el disco (borra el volumen):

```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## Resetear la base de datos local

Cuando una migración te deja la BD en un estado raro o quieres empezar limpio:

```bash
docker compose -f docker-compose.dev.yml down -v   # borra volumen
make db-up                                          # vuelve a crearla
make migrate                                        # aplica todo desde 0
```

> 💡 La plantilla no incluye seed de datos. Si tu producto los necesita,
> añade un script en `backend/scripts/seed.py` y un target `make seed`.

---

## Hot reload: qué se recarga y qué no

### Backend (`uvicorn --reload`)

Se recarga:

- Cualquier `.py` dentro de `backend/app/`.

**No** se recarga:

- Cambios en `pyproject.toml` (deps nuevas): para y vuelve a `make install`
  + `make backend-dev`.
- Cambios en variables de entorno (`.env`): para y arranca de nuevo. Las
  `Settings` se cachean con `@lru_cache`.
- Migraciones: corre `make migrate` aparte; Uvicorn no las aplica.

### Frontend (Vite HMR)

Se recarga **en caliente** sin perder estado de la mayoría de componentes:

- Cualquier `.ts`, `.tsx`, `.css` en `frontend/src/`.

Recarga completa de la pestaña:

- `vite.config.ts`, `tsconfig.json`, `package.json`.

**No** se recarga:

- Deps nuevas (`pnpm add`): para y vuelve a `make frontend-dev`.

---

## Tip: usar `/docs` para probar endpoints sin frontend

FastAPI expone Swagger UI en <http://localhost:8000/docs>. Te permite:

- Ver todos los endpoints con sus schemas.
- Lanzar requests desde el navegador.
- Usar el botón **Authorize** para meter un Bearer token y probar endpoints
  protegidos.

Flujo típico para probar endpoints autenticados:

1. `POST /api/v1/auth/register` con tu email y password.
2. `POST /api/v1/auth/login` con `username` (= email) y `password`. Copia el
   `access_token` de la respuesta.
3. Click en **Authorize** (candado arriba a la derecha) → pega el token.
4. Ya puedes lanzar cualquier endpoint protegido.

ReDoc en <http://localhost:8000/redoc> es una vista alternativa, solo lectura,
útil para compartir.

---

## Trabajar con la BD desde la terminal

Cadena de conexión por defecto:

```
postgresql://app:app@localhost:5432/app
```

`psql` rápido:

```bash
docker exec -it app_postgres_dev psql -U app -d app
```

Listar tablas: `\dt`. Salir: `\q`. Más en
[05-database](05-database.md#conectarse-a-la-bd-con-psql-o-cliente-gui).

---

## Antes de abrir un PR

Pasa el pipeline completo en local. Sugerencia de alias en tu shell:

```bash
make lint && make typecheck && make test
```

CI corre lo mismo (ver [.github/workflows/ci.yml](../.github/workflows/ci.yml)).
Más detalle en [08-code-quality](08-code-quality.md).

---

## Siguiente paso

- Añadir/cambiar el frontend → [03-frontend](03-frontend.md).
- Añadir un endpoint nuevo → [04-writing-endpoints](04-writing-endpoints.md).
