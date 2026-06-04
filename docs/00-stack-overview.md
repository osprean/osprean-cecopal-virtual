# 00 — El stack: qué es cada herramienta y por qué la usamos

Esta es una doc de referencia. Si ya conoces todas las herramientas del repo,
puedes saltarla y arrancar por [01-getting-started](01-getting-started.md).

Si no, léetela una vez de arriba abajo. Está pensada **asumiendo cero contexto
previo**: solo asumimos que sabes programar y usar la terminal y Git.

Para cada herramienta seguimos el mismo patrón:

1. **Qué es** (1-2 frases).
2. **Qué problema resuelve** (por qué la elegimos sobre alternativas).
3. **Cómo aparece en este proyecto** (qué archivos, qué comandos).
4. **Doc oficial** (enlace para profundizar).

---

## Lenguajes y runtimes

### Python 3.12

- **Qué es.** Lenguaje del backend.
- **Qué problema resuelve.** Versión moderna con mejoras de rendimiento y de
  sintaxis (genéricos sin `from __future__ import annotations` en muchos casos,
  mejores mensajes de error, `TypeAliasType`, etc.).
- **Cómo aparece.** `backend/pyproject.toml` declara
  `requires-python = ">=3.12"`. `uv` instala la versión correcta si no la
  tienes en el sistema.
- **Doc.** <https://docs.python.org/3.12/>

### Node.js 20

- **Qué es.** Runtime de JavaScript fuera del navegador. Solo se usa para
  herramientas (Vite, ESLint, Vitest…), **no** corre en producción.
- **Qué problema resuelve.** Ecosistema completo de tooling frontend.
- **Cómo aparece.** `frontend/package.json` → `"engines": { "node": ">=20" }`.
- **Doc.** <https://nodejs.org/>

### TypeScript

- **Qué es.** JavaScript con tipos estáticos. Compila a JS plano antes de
  ejecutarse.
- **Qué problema resuelve.** Pillas errores antes de ejecutar, autocompletado
  fiable en el editor, refactors seguros.
- **Cómo aparece.** Modo `strict` en `frontend/tsconfig.json`. Compila con
  `tsc -b` durante `pnpm build`.
- **Doc.** <https://www.typescriptlang.org/docs/>

---

## Backend

### FastAPI

- **Qué es.** Framework web Python moderno, async, basado en Pydantic para
  validación y en Starlette para HTTP.
- **Qué problema resuelve.** Endpoints declarativos con tipos → validación de
  request/response gratis + docs OpenAPI/Swagger generadas automáticamente.
  Frente a Flask: async nativo, validación gratis, docs gratis.
- **Cómo aparece.** Toda `backend/app/api/` lo usa. Docs interactivas en
  `http://localhost:8000/docs`.
- **Doc.** <https://fastapi.tiangolo.com/>

### uv

- **Qué es.** Gestor de paquetes Python ultrarrápido escrito en Rust.
- **Qué problema resuelve.** Reemplaza `pip + venv + pip-tools + pyenv` en una
  sola herramienta: 10–100× más rápido, lockfile reproducible (`uv.lock`), y
  gestiona también la versión de Python.
- **Cómo aparece.**
  - `uv sync` instala deps en `.venv/` desde `pyproject.toml` + `uv.lock`.
  - `uv add paquete` añade una dep.
  - `uv run comando` ejecuta algo dentro del venv (sin tener que activarlo).
  - `make install` lo invoca por ti.
- **Doc.** <https://docs.astral.sh/uv/>

### `pyproject.toml`

- **Qué es.** Archivo estándar moderno (PEP 621) donde se declaran las
  dependencias y la configuración de herramientas (ruff, mypy, pytest, coverage).
- **Qué problema resuelve.** Antes hacían falta `setup.py` + `requirements.txt`
  + `setup.cfg` + `pytest.ini` + `mypy.ini` + `.flake8`. Ahora un solo archivo.
- **Cómo aparece.** [backend/pyproject.toml](../backend/pyproject.toml).
- **Doc.** <https://packaging.python.org/en/latest/guides/writing-pyproject-toml/>

### SQLAlchemy 2.0

- **Qué es.** ORM (Object-Relational Mapper) para Python: escribes queries con
  clases y objetos en vez de SQL crudo.
- **Qué problema resuelve.** Type-safe, soporte async nativo en 2.0, abstracción
  sobre PostgreSQL/MySQL/SQLite. Permite testear con SQLite en local y correr en
  Postgres en producción.
- **Cómo aparece.**
  - `backend/app/database.py` configura el engine async.
  - `backend/app/models/` define las tablas como clases.
  - `backend/app/repositories/` usa `select(...)`, `session.get(...)`, etc.
- **Doc.** <https://docs.sqlalchemy.org/en/20/>

### asyncpg

- **Qué es.** Driver de PostgreSQL para Python async.
- **Qué problema resuelve.** El más rápido del ecosistema. SQLAlchemy lo usa por
  debajo cuando el DSN empieza por `postgresql+asyncpg://`.
- **Cómo aparece.** Solo en la cadena `DATABASE_URL` y como dep. Tú no lo
  invocas directamente.
- **Doc.** <https://magicstack.github.io/asyncpg/>

### Alembic

- **Qué es.** Herramienta de migraciones para SQLAlchemy. Versiona cambios en
  el esquema de la BD.
- **Qué problema resuelve.** Crear/modificar tablas de forma reproducible y
  versionada. Es a la BD lo que Git es al código: te permite avanzar y
  retroceder en el tiempo.
- **Cómo aparece.**
  - `backend/alembic/versions/` guarda las migraciones.
  - `make migration name="add_foo"` genera una nueva (autogenerate).
  - `make migrate` aplica las pendientes.
- **Doc.** <https://alembic.sqlalchemy.org/>

### Pydantic v2

- **Qué es.** Librería de validación de datos basada en type hints.
- **Qué problema resuelve.** FastAPI la usa para validar requests/responses
  automáticamente. Si declaras un schema con un `int`, devuelve 422 si llega un
  string. Sin escribir validación a mano.
- **Cómo aparece.** `backend/app/schemas/` define DTOs como subclases de
  `BaseModel`.
- **Doc.** <https://docs.pydantic.dev/2/>

### pydantic-settings

- **Qué es.** Extensión de Pydantic para configuración.
- **Qué problema resuelve.** Carga variables de entorno y archivos `.env` con
  validación y tipos. Fin de `os.environ.get(...) or "default"`.
- **Cómo aparece.** [backend/app/config.py](../backend/app/config.py) define la
  clase `Settings(BaseSettings)`.
- **Doc.** <https://docs.pydantic.dev/latest/concepts/pydantic_settings/>

### PyJWT

- **Qué es.** Librería para crear y verificar JSON Web Tokens.
- **Qué problema resuelve.** Auth stateless: el token lleva firmada la identidad
  del usuario, no hace falta sesión en servidor.
- **Cómo aparece.** [backend/app/core/security.py](../backend/app/core/security.py)
  → `JwtTokenService`.
- **Doc.** <https://pyjwt.readthedocs.io/>

### passlib[bcrypt]

- **Qué es.** Librería de hashing de contraseñas. Soporta varios algoritmos;
  usamos bcrypt.
- **Qué problema resuelve.** Almacenar contraseñas de forma segura (hashing
  lento, con sal, resistente a fuerza bruta).
- **Cómo aparece.** `BcryptPasswordHasher` en `core/security.py`.
- **Doc.** <https://passlib.readthedocs.io/>

### structlog

- **Qué es.** Librería de logging estructurado.
- **Qué problema resuelve.** En Kubernetes los logs van a un agregador (Loki,
  ELK, Datadog). El JSON estructurado es mucho más fácil de filtrar/consultar
  que texto plano. Frente al `logging` de stdlib: ergonómico, integra context
  vars (request_id), salida JSON sin configurar parsers raros.
- **Cómo aparece.** [backend/app/core/logging.py](../backend/app/core/logging.py).
  Middleware en `main.py` añade `request_id` a cada log.
- **Doc.** <https://www.structlog.org/>

### uvicorn

- **Qué es.** Servidor ASGI. Ejecuta tu app FastAPI.
- **Qué problema resuelve.** ASGI es el estándar Python async (equivalente a
  WSGI para sync). Uvicorn es la implementación más usada.
- **Cómo aparece.**
  - `make backend-dev` corre `uvicorn app.main:app --reload`.
  - El contenedor de producción usa `CMD ["uvicorn", "app.main:app", ...]`.
- **Doc.** <https://www.uvicorn.org/>

### httpx

- **Qué es.** Cliente HTTP moderno para Python. Soporta async, mantiene la API
  de `requests`.
- **Qué problema resuelve.** En tests lo usamos como `TestClient` async sobre
  FastAPI sin levantar servidor real. Si necesitas llamar APIs externas, también
  es la opción por defecto.
- **Cómo aparece.** Fixture `client` en [backend/tests/conftest.py](../backend/tests/conftest.py).
- **Doc.** <https://www.python-httpx.org/>

---

## Frontend

### React 18

- **Qué es.** Librería de UI basada en componentes.
- **Qué problema resuelve.** Estándar de facto para SPAs. Ecosistema enorme.
- **Cómo aparece.** Todo `frontend/src/`.
- **Doc.** <https://react.dev/>

### Vite

- **Qué es.** Bundler + dev server para frontend.
- **Qué problema resuelve.** Reemplaza webpack/CRA: arranque casi instantáneo,
  hot reload muy rápido, builds optimizados.
- **Cómo aparece.**
  - [frontend/vite.config.ts](../frontend/vite.config.ts) configura proxy
    `/api → :8000`.
  - `pnpm dev` arranca el dev server en `:5173`.
  - `pnpm build` produce el bundle en `frontend/dist/`.
- **Doc.** <https://vitejs.dev/>

### pnpm

- **Qué es.** Gestor de paquetes JS alternativo a npm/yarn.
- **Qué problema resuelve.** Usa hard links a un store global: ahorras GB de
  disco si tienes muchos proyectos. Instalación más rápida. Resolución estricta
  (no permite usar deps no declaradas), lo que evita bugs de transitividad.
- **Cómo aparece.**
  - `pnpm install`, `pnpm add`, `pnpm run dev` (o `pnpm dev`).
  - `frontend/pnpm-lock.yaml` se commitea.
- **Doc.** <https://pnpm.io/>

### TanStack Query (React Query)

- **Qué es.** Librería para gestionar el estado del servidor en el cliente.
- **Qué problema resuelve.** Elimina el 80% del código de `fetch` + `useState`
  + `useEffect`. Maneja caché, refetch, deduplicación, estados loading/error/
  success, invalidación.
- **Cómo aparece.** `frontend/src/main.tsx` monta el `QueryClientProvider`.
  `ItemsPage` usa `useQuery` + `useMutation`.
- **Doc.** <https://tanstack.com/query/latest>

### axios

- **Qué es.** Cliente HTTP basado en promesas.
- **Qué problema resuelve.** Lo elegimos por sus *interceptors*: añadir el JWT
  a cada request y reintentar con refresh ante 401 sin tocar cada llamada.
- **Cómo aparece.** [frontend/src/api/client.ts](../frontend/src/api/client.ts).
- **Doc.** <https://axios-http.com/>

### React Router

- **Qué es.** Routing en cliente (qué componente se ve según la URL).
- **Qué problema resuelve.** SPA con rutas declarativas y navegación sin recarga.
- **Cómo aparece.** [frontend/src/App.tsx](../frontend/src/App.tsx) declara las
  `<Route>`. `ProtectedRoute` redirige a `/login` si no hay sesión.
- **Doc.** <https://reactrouter.com/>

---

## Calidad de código

### ruff

- **Qué es.** Linter (detecta problemas) + formatter de Python, escrito en Rust.
- **Qué problema resuelve.** Reemplaza black + isort + flake8 + pylint en una
  sola herramienta 100× más rápida. Mismo formato y mismas reglas para todo el
  equipo.
- **Cómo aparece.**
  - Config en `[tool.ruff]` de `backend/pyproject.toml`.
  - Reglas activas: `E, F, I, B, C4, UP, SIM, RUF, PL`.
  - `make lint` corre check + format check; `make format` aplica cambios.
- **Doc.** <https://docs.astral.sh/ruff/>

### mypy

- **Qué es.** Type checker estático para Python.
- **Qué problema resuelve.** Verifica que el código respeta los type hints. Si
  una función dice `def foo(x: int) -> str`, mypy se queja si pasas un str o
  devuelves un int. Modo `strict` (activado) prohíbe `Any` no documentado.
- **Cómo aparece.**
  - `[tool.mypy]` en `pyproject.toml`.
  - `make typecheck` o `uv run mypy app`.
- **Doc.** <https://mypy.readthedocs.io/>

### ESLint

- **Qué es.** Linter de JS/TS.
- **Qué problema resuelve.** Detecta bugs y malas prácticas. Con
  `@typescript-eslint` y `eslint-plugin-react`/`react-hooks` cubre TS+React.
- **Cómo aparece.** [frontend/.eslintrc.cjs](../frontend/.eslintrc.cjs).
  `pnpm lint` o `make lint`.
- **Doc.** <https://eslint.org/>

### Prettier

- **Qué es.** Formatter opinionado para JS/TS/CSS/JSON/Markdown.
- **Qué problema resuelve.** Cero discusiones de estilo: aplica el suyo.
  Integra con ESLint sin solaparse (`eslint-config-prettier` desactiva las
  reglas de estilo de ESLint).
- **Cómo aparece.** [frontend/.prettierrc](../frontend/.prettierrc). `pnpm format`.
- **Doc.** <https://prettier.io/>

### pre-commit

- **Qué es.** Framework que ejecuta hooks (ruff, mypy, ESLint, Prettier) antes
  de cada `git commit`.
- **Qué problema resuelve.** Garantiza que nada sin formatear/lintar/tipar entra
  al repo. CI deja de fallar por "olvidé correr ruff".
- **Cómo aparece.**
  - [.pre-commit-config.yaml](../.pre-commit-config.yaml) en la raíz.
  - Instalación: `uv run pre-commit install` una vez por clon.
- **Doc.** <https://pre-commit.com/>

---

## Testing

### pytest

- **Qué es.** Framework de tests Python. Estándar de facto.
- **Qué problema resuelve.** Tests con `assert` normal, fixtures componibles,
  plugins para casi todo.
- **Cómo aparece.** `backend/tests/`. `make test`.
- **Doc.** <https://docs.pytest.org/>

### pytest-asyncio

- **Qué es.** Plugin para testear funciones `async`.
- **Qué problema resuelve.** Sin él pytest no ejecuta coroutines. Configurado en
  modo `auto` → cualquier `async def test_*` se ejecuta sin decoradores.
- **Cómo aparece.** `[tool.pytest.ini_options]` → `asyncio_mode = "auto"`.
- **Doc.** <https://pytest-asyncio.readthedocs.io/>

### pytest-cov

- **Qué es.** Mide *coverage*: porcentaje de líneas de tu código ejecutadas por
  los tests.
- **Qué problema resuelve.** Detectar código no testeado.

> ⚠️ Coverage **no** es garantía de calidad. Puedes tener 100% con tests
> inútiles. Úsalo como señal, no como meta absoluta. Mínimo configurado: 80%.

- **Cómo aparece.** `make test-cov` o `uv run pytest --cov=app`.
- **Doc.** <https://pytest-cov.readthedocs.io/>

### Vitest

- **Qué es.** El "pytest del frontend". Framework de tests integrado con Vite.
- **Qué problema resuelve.** Mismo API que Jest pero usa la pipeline de Vite →
  arranque casi instantáneo, HMR en watch mode.
- **Cómo aparece.** Config dentro de `frontend/vite.config.ts` (sección `test`).
  `pnpm test` (run) o `pnpm test:watch`.
- **Doc.** <https://vitest.dev/>

### React Testing Library (RTL)

- **Qué es.** Utilidades para testear componentes React.
- **Qué problema resuelve.** Testea lo que ve el usuario (texto, roles, clics)
  en vez de detalles de implementación. Si renombras una prop interna, los tests
  no se rompen.
- **Cómo aparece.** [frontend/tests/LoginPage.test.tsx](../frontend/tests/LoginPage.test.tsx).
- **Doc.** <https://testing-library.com/docs/react-testing-library/intro/>

---

## Infraestructura

### Docker

- **Qué es.** Plataforma de contenedores: empaqueta tu app + sus deps en una
  imagen aislada que corre igual en cualquier máquina.
- **Qué problema resuelve.** "En mi máquina funciona" deja de existir.
- **Cómo aparece.** `docker/Dockerfile` produce la imagen de producción;
  `make build` la construye.
- **Doc.** <https://docs.docker.com/>

### Dockerfile multi-stage

- **Qué es.** Técnica para builds Docker pequeños.
- **Qué problema resuelve.** Construyes en una imagen pesada (con compiladores,
  node, pnpm…) y copias **solo el resultado** a una imagen final ligera. Objetivo
  aquí: < 250 MB.
- **Cómo aparece.** [docker/Dockerfile](../docker/Dockerfile) tiene 3 stages:
  `frontend-builder` (node + pnpm) → `backend-builder` (uv) → `runtime`
  (`python:3.12-slim`).
- **Doc.** <https://docs.docker.com/build/building/multi-stage/>

### docker-compose

- **Qué es.** Herramienta para orquestar varios contenedores juntos.
- **Qué problema resuelve.** En desarrollo, levanta Postgres con un comando sin
  instalar nada en el host.
- **Cómo aparece.** [docker-compose.dev.yml](../docker-compose.dev.yml) con un
  único servicio `postgres`. `make db-up` / `make db-down`.
- **Doc.** <https://docs.docker.com/compose/>

### Makefile

- **Qué es.** Colección de comandos cortos (`make dev`, `make test`).
- **Qué problema resuelve.** Abrevia secuencias largas; sirve de "menú" del
  proyecto. `make help` lista los targets.
- **Cómo aparece.** [Makefile](../Makefile) en la raíz.
- **Doc.** <https://www.gnu.org/software/make/manual/>

### GitHub Actions

- **Qué es.** CI/CD integrado en GitHub.
- **Qué problema resuelve.** Corre lint + typecheck + tests + build en cada PR
  y push. Detecta problemas antes de mergear.
- **Cómo aparece.** [.github/workflows/ci.yml](../.github/workflows/ci.yml) con
  jobs `backend-lint`, `backend-test` (con Postgres), `frontend-lint`,
  `frontend-test`, `docker-build`.
- **Doc.** <https://docs.github.com/en/actions>

### Kubernetes (K8s)

- **Qué es.** Orquestador de contenedores.
- **Qué problema resuelve.** Despliega, escala y monitoriza imágenes Docker en
  cluster. Lo gestiona DevOps; como dev solo necesitas saber que tu imagen
  acaba ahí.
- **Cómo aparece.** No hay manifiestos en este repo (viven en el repo de
  infraestructura). La imagen está pensada para K8s: health checks
  `/health/live` y `/health/ready` listos para `livenessProbe` y
  `readinessProbe`.
- **Doc.** <https://kubernetes.io/docs/>

---

## ¿Por dónde sigo?

- [01-getting-started](01-getting-started.md) — clonar la plantilla y dejar el
  entorno funcionando.
- [02-local-development](02-local-development.md) — flujo de trabajo diario.
