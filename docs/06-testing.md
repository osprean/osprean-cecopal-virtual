# 06 — Testing

Backend con pytest. Frontend con Vitest + React Testing Library. Coverage
mínimo en backend: **80%**.

---

## Estructura de los tests del backend

```
backend/tests/
├── conftest.py          # fixtures: engine, db_session, client, user_payload
├── unit/                # sin DB, sin red — solo lógica pura
│   └── test_security.py
└── integration/         # con DB real + httpx AsyncClient sobre la app
    ├── test_auth.py
    ├── test_health.py
    └── test_items.py
```

| Tipo | Qué prueba | Velocidad | Cuándo usarlo |
|---|---|---|---|
| **unit** | Funciones puras, validaciones, primitives | ⚡ | Lógica sin I/O |
| **integration** | Endpoints end-to-end con DB | 🐢 | Comportamiento de la API |

### Cómo está montada la fixture de BD

`backend/tests/conftest.py` crea un engine async de tests:

- Por defecto usa **SQLite in-memory** (`sqlite+aiosqlite:///:memory:`) para que
  corra en local sin Postgres.
- En CI se exporta `TEST_DATABASE_URL` apuntando al Postgres del workflow.
- Por cada test: `Base.metadata.create_all` → corre el test → `drop_all`.
  Aislamiento total, sin estado compartido.
- La fixture `client` sobrescribe `get_session` para que los endpoints usen la
  misma sesión que el test.

---

## Ejecutar tests

### Todo (backend + frontend)

```bash
make test
```

### Con coverage (backend)

```bash
make test-cov
```

Imprime un resumen y genera `backend/coverage.xml` para el CI.
El mínimo aceptado es **80%**; por debajo, `pytest` falla.

### Un solo archivo

```bash
cd backend
uv run pytest tests/integration/test_auth.py
```

### Un solo test

```bash
uv run pytest tests/integration/test_auth.py::test_register_login_me_refresh
```

### Por nombre (match parcial)

```bash
uv run pytest -k "login"
```

### Parar en el primer fallo

```bash
uv run pytest -x
```

### Verbose + ver `print()`s

```bash
uv run pytest -vv -s
```

---

## Escribir un test nuevo

### Patrón unit (sin DB)

Crea o edita un archivo en `backend/tests/unit/`. Como pytest está en modo
`asyncio_mode = "auto"`, cualquier `async def test_*` se ejecuta sin
decoradores.

```python
# backend/tests/unit/test_security.py
from app.core.security import BcryptPasswordHasher


def test_password_roundtrip() -> None:
    hasher = BcryptPasswordHasher()
    h = hasher.hash("hunter2-extra-long")
    assert hasher.verify("hunter2-extra-long", h) is True
    assert hasher.verify("wrong", h) is False
```

### Patrón integration (con DB + cliente HTTP)

Usa las fixtures `client` (un `httpx.AsyncClient` ya conectado a la app) y, si
necesitas datos pre-cargados, `db_session`.

```python
# backend/tests/integration/test_products.py
from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, email: str) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password-12345", "full_name": None},
    )
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "password-12345"},
    )
    return str(r.json()["access_token"])


async def test_create_product(client: AsyncClient) -> None:
    token = await _register_and_login(client, "a@example.com")
    r = await client.post(
        "/api/v1/products",
        json={"name": "X", "price_cents": 100},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201
```

### Tests asíncronos: no hace falta decorador

Gracias a `asyncio_mode = "auto"` en `[tool.pytest.ini_options]`:

```python
async def test_foo() -> None:   # se ejecuta como coroutine automáticamente
    ...
```

Si en algún momento quieres deshabilitar `auto` puntualmente:

```python
import pytest

@pytest.mark.asyncio
async def test_bar() -> None:
    ...
```

### Fixtures disponibles (de `conftest.py`)

| Fixture | Scope | Qué da |
|---|---|---|
| `engine` | session | Engine SQLAlchemy async, una vez por toda la sesión |
| `db_session` | function | `AsyncSession` aislada con tablas recién creadas |
| `client` | function | `httpx.AsyncClient` apuntando a la app, con `get_session` sobrescrita |
| `user_payload` | function | `dict` con email/password/full_name de ejemplo |

Añade tus propias fixtures en `conftest.py` (raíz de `tests/`) o en un
`conftest.py` dentro de un subdirectorio si solo aplica allí.

### Crear un usuario en un test sin pasar por la API

```python
from app.models.user import User
from app.core.security import build_password_hasher


async def test_with_seeded_user(db_session) -> None:
    hasher = build_password_hasher()
    user = User(
        email="seed@example.com",
        hashed_password=hasher.hash("password-12345"),
    )
    db_session.add(user)
    await db_session.commit()
    # ... ahora usa user.id en tus aserciones
```

---

## Modificar el coverage mínimo

Vive en [backend/pyproject.toml](../backend/pyproject.toml):

```toml
[tool.coverage.run]
source = ["app"]
omit = ["app/main.py", "alembic/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
skip_covered = false
```

### Subir/bajar el mínimo

Cambia `fail_under`. Bájalo solo de forma temporal y documenta por qué.

### Excluir un archivo

Añade al `omit`:

```toml
omit = ["app/main.py", "alembic/*", "app/integrations/legacy.py"]
```

### Excluir una línea concreta

Marca con un comentario:

```python
if TYPE_CHECKING:  # pragma: no cover
    from app.models.user import User
```

### Ver qué líneas no están cubiertas

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
```

`--cov-report=html` genera `backend/htmlcov/index.html` navegable.

---

## Frontend

### Cómo está montado

- Config dentro de [frontend/vite.config.ts](../frontend/vite.config.ts)
  (sección `test`).
- Entorno `jsdom` (DOM simulado en Node).
- Setup file [frontend/tests/setup.ts](../frontend/tests/setup.ts) importa
  `@testing-library/jest-dom/vitest` (matchers `.toBeInTheDocument()` etc.) y
  hace `cleanup()` tras cada test.

### Correr tests

```bash
cd frontend
pnpm test            # corre una vez (CI)
pnpm test:watch      # watch mode
```

O desde la raíz:

```bash
make test            # también corre Vitest
```

### Escribir un test de componente

Patrón RTL: renderizas, buscas por **rol/texto** (no por id), interactúas con
`userEvent`, aserciones con matchers de `jest-dom`.

```typescript
// frontend/tests/MyButton.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyButton } from "@/components/MyButton";

describe("<MyButton />", () => {
  it("dispara onClick al hacer click", async () => {
    const onClick = vi.fn();
    render(<MyButton onClick={onClick}>Guardar</MyButton>);
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

### Mockear llamadas a la API

Opción rápida: mockea la función del módulo `api/` con `vi.mock`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemsPage } from "@/pages/ItemsPage";

vi.mock("@/api/items", () => ({
  listItems: vi.fn().mockResolvedValue([
    { id: 1, name: "Test", description: null, owner_id: 1, created_at: "" },
  ]),
  createItem: vi.fn(),
}));

it("renderiza items", async () => {
  // necesitarás envolver en QueryClientProvider + Router
  // ...
  expect(await screen.findByText("Test")).toBeInTheDocument();
});
```

Para tests más realistas (interceptar HTTP de verdad), instala
[`msw`](https://mswjs.io/) — no viene en la plantilla por defecto pero encaja
bien con Vitest.

### Helpers comunes para tests con providers

Si vas a renderizar muchos componentes que necesitan
`QueryClientProvider` + `MemoryRouter` + `AuthProvider`, crea un helper:

```typescript
// frontend/tests/utils.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

export function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}
```

> 💡 Con `retry: false` en tests evitas que las queries hagan reintentos
> automáticos cuando un mock falla.

---

## Antes de subir un PR

```bash
make test          # backend + frontend
make test-cov      # asegúrate de no haber bajado del 80% en backend
```

CI corre exactamente lo mismo. Ver [.github/workflows/ci.yml](../.github/workflows/ci.yml).

---

## Siguiente paso

- Calidad de código (lint, format, types) → [08-code-quality](08-code-quality.md).
- Gestión de deps → [07-dependencies](07-dependencies.md).
