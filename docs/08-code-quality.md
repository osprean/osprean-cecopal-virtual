# 08 — Calidad de código: lint, format, types, pre-commit

Mismo pipeline en local que en CI. Si pasa en local, pasa en CI.

---

## Backend

### Lint con ruff

```bash
make lint
```

Equivale a:

```bash
cd backend
uv run ruff check .            # detecta problemas
uv run ruff format --check .   # comprueba formato (no modifica)
```

`make lint` también dispara la parte frontend; si solo quieres backend usa los
comandos `uv run` directos.

### Aplicar fixes automáticos

```bash
make format
```

Equivale a:

```bash
cd backend
uv run ruff check --fix .      # arregla lo arreglable (imports, simplificaciones)
uv run ruff format .           # formatea el código
```

### Reglas activas

En [backend/pyproject.toml](../backend/pyproject.toml):

```toml
[tool.ruff.lint]
select = ["E", "F", "I", "B", "C4", "UP", "SIM", "RUF", "PL"]
ignore = [
    "PLR0913",  # too many args — FastAPI deps lo justifican
    "PLR2004",  # magic values en tests
]
```

| Código | Qué cubre |
|---|---|
| `E` | pycodestyle: estilo PEP 8 |
| `F` | pyflakes: imports sin usar, vars sin usar, undefined |
| `I` | isort: orden de imports |
| `B` | flake8-bugbear: bugs comunes |
| `C4` | flake8-comprehensions: list/dict/set comp mejor escritas |
| `UP` | pyupgrade: usar sintaxis moderna (py3.12) |
| `SIM` | flake8-simplify: simplificaciones (`if x: return True else: return False`) |
| `RUF` | reglas propias de ruff |
| `PL` | pylint (subset) |

### Añadir/quitar reglas

Edita `select` o `ignore` en `pyproject.toml`. Lista completa de reglas:
<https://docs.astral.sh/ruff/rules/>.

Para silenciar una línea concreta:

```python
result = json.loads(data)  # noqa: PLW0603
```

### Type-check con mypy

```bash
make typecheck      # corre mypy + tsc
# o solo backend:
cd backend && uv run mypy app
```

Modo `strict` activo en `[tool.mypy]`. Eso implica, entre otras cosas:

- Toda función necesita type hints (params y return).
- Sin `Any` implícito.
- Sin reasignar tipos de variables.

Si una librería de terceros no tiene stubs, añade override en `pyproject.toml`:

```toml
[[tool.mypy.overrides]]
module = ["libreria_sin_stubs.*"]
ignore_missing_imports = true
```

---

## Frontend

Todos los comandos se ejecutan desde `frontend/`, o vía `make` desde la raíz.

### Lint con ESLint

```bash
cd frontend
pnpm lint           # ESLint con --max-warnings=0 (CI estricto)
```

Config en [frontend/.eslintrc.cjs](../frontend/.eslintrc.cjs):

- Base: `@typescript-eslint/recommended` + `react/recommended` + `react-hooks`.
- Integrado con Prettier (`eslint-config-prettier` desactiva reglas de estilo
  que solaparían con Prettier).
- Errores incluidos: `@typescript-eslint/no-unused-vars`,
  `@typescript-eslint/consistent-type-imports`.

### Format con Prettier

```bash
pnpm format         # aplica cambios
pnpm format:check   # solo comprueba (CI)
```

Config en [frontend/.prettierrc](../frontend/.prettierrc):

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Type-check con tsc

```bash
pnpm type-check     # tsc -b --noEmit
```

`tsconfig.json` está en modo `strict` + `noUncheckedIndexedAccess` (acceder a
arrays/dicts devuelve `T | undefined`). Esto pilla muchos bugs antes.

---

## Pre-commit

`pre-commit` corre las herramientas anteriores **antes de cada `git commit`**.
Garantiza que nada sin lintar/formatear/tipar entra al repo.

### Instalación (una vez por clon)

```bash
uv run pre-commit install
```

A partir de aquí, cada `git commit` dispara los hooks listados en
[.pre-commit-config.yaml](../.pre-commit-config.yaml).

### Hooks configurados

| Hook | Cuándo |
|---|---|
| `trailing-whitespace`, `end-of-file-fixer` | siempre |
| `check-yaml`, `check-added-large-files`, `check-merge-conflict`, `detect-private-key` | siempre |
| `ruff` (con `--fix`) + `ruff-format` | sobre `backend/` |
| `mypy` | sobre `backend/app/` |
| `eslint` | sobre `frontend/*.{ts,tsx,js,jsx}` |
| `prettier --check` | sobre `frontend/*.{ts,tsx,js,jsx,json,css,md}` |

### Si pre-commit modifica archivos

Pre-commit a veces arregla cosas (formato) → cancela el commit y deja los
cambios en disco. Reintenta:

```bash
git add -A
git commit -m "tu mensaje"
```

### Correr pre-commit a mano (sin commitear)

```bash
uv run pre-commit run --all-files
```

Útil para limpiar todo el repo de golpe (la primera vez en proyectos viejos).

### Saltarse pre-commit puntualmente

```bash
git commit --no-verify -m "WIP"
```

> ⚠️ **Casi nunca deberías hacerlo.** Solo en escenarios como:
>
> - Commit de un WIP en una rama personal que sabes que vas a rebasear.
> - Romper un hook que necesitas arreglar en el siguiente commit (raro).
>
> Si CI te falla en main por un commit con `--no-verify`, es culpa tuya.

---

## Pipeline completo en local antes de PR

Ejecuta todo lo que CI ejecutaría:

```bash
make lint && make typecheck && make test
```

> 💡 Si te lo vas a saltar a menudo, añade un target en tu Makefile:
>
> ```make
> check-all: ## Pipeline completo (lint + types + tests)
> 	$(MAKE) lint
> 	$(MAKE) typecheck
> 	$(MAKE) test
> ```

---

## CI: GitHub Actions

[.github/workflows/ci.yml](../.github/workflows/ci.yml) define 5 jobs que se
disparan en cada push a `main` y en cada PR:

| Job | Qué corre |
|---|---|
| `backend-lint` | `ruff check`, `ruff format --check`, `mypy` |
| `backend-test` | `pytest --cov` con servicio Postgres real |
| `frontend-lint` | `pnpm lint`, `pnpm format:check`, `pnpm type-check` |
| `frontend-test` | `pnpm test` (Vitest) |
| `docker-build` | Build de la imagen multi-stage (no push) |

Los 4 primeros corren en paralelo. `docker-build` espera a que los 4 pasen.

Si CI falla por algo que pasa en local, suele ser una de estas dos:

- Cambio en `pyproject.toml`/`package.json` sin actualizar el lockfile.
- Test que depende de zona horaria, paralelismo, o de Postgres específicamente
  (no SQLite). Exporta `TEST_DATABASE_URL` localmente apuntando a Postgres
  para reproducir.

---

## Siguiente paso

- Variables de entorno y secretos → [09-configuration](09-configuration.md).
- Si algo no funciona → [10-troubleshooting](10-troubleshooting.md).
