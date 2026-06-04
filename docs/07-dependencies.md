# 07 — Gestión de dependencias

Backend con `uv`, frontend con `pnpm`. Ambos lockfiles se commitean al repo.

---

## Backend (uv)

`uv` es el gestor de paquetes Python ultrarrápido (Rust). Reemplaza
`pip + venv + pip-tools + pyenv`. Si no lo conoces, lee
[00-stack-overview → uv](00-stack-overview.md#uv).

Todos los comandos se ejecutan desde `backend/`.

### Estado actual

- `pyproject.toml` → declara deps de producción (`[project.dependencies]`) y
  de desarrollo (`[dependency-groups].dev`).
- `uv.lock` → bloquea versiones exactas resueltas. **Se commitea.**
- `.venv/` → entorno virtual local. **No** se commitea.

### Instalar el entorno (primera vez o tras `git pull`)

```bash
cd backend
uv sync
```

`uv sync` lee `pyproject.toml` + `uv.lock` y deja el `.venv/` en el estado
exacto del lock. Es idempotente y rápido.

### Añadir una dependencia de producción

```bash
cd backend
uv add httpx-cache
```

Esto:

1. Resuelve la versión más reciente compatible.
2. La añade a `pyproject.toml` → `[project.dependencies]`.
3. Actualiza `uv.lock`.
4. La instala en `.venv/`.

### Añadir una dependencia de desarrollo

```bash
cd backend
uv add --dev pytest-mock
```

Se añade al grupo `dev` (no entra a la imagen Docker de producción).

### Fijar una versión concreta

```bash
uv add "fastapi==0.115.2"
uv add "fastapi>=0.115,<0.116"
```

### Actualizar deps

Actualizar **todas** dentro de los rangos declarados:

```bash
uv sync --upgrade
```

Actualizar una concreta a la última:

```bash
uv add fastapi@latest
```

### Quitar una dep

```bash
uv remove paquete
```

### Ejecutar comandos dentro del venv

`uv run <cmd>` ejecuta sin necesidad de activar el venv:

```bash
uv run pytest
uv run alembic upgrade head
uv run python -c "import app; print(app.__version__)"
```

Si prefieres activar el venv "a la antigua":

```bash
source .venv/bin/activate    # macOS/Linux
pytest                       # ya tienes los comandos disponibles
deactivate                   # cuando termines
```

### Importante

> ⚠️ **`uv.lock` siempre se commitea.** Es lo que garantiza que tu compañero
> y CI instalen exactamente las mismas versiones que tú.

---

## Frontend (pnpm)

`pnpm` es el gestor de paquetes JS que usa hard links a un store global →
ahorras GB de disco y la instalación es más rápida.

Todos los comandos se ejecutan desde `frontend/`.

### Estado actual

- `package.json` → declara deps (`dependencies` y `devDependencies`) y
  scripts.
- `pnpm-lock.yaml` → bloquea versiones exactas. **Se commitea.**
- `node_modules/` → instalación local con hard links al store. **No** se
  commitea.

### Instalar (primera vez o tras `git pull`)

```bash
cd frontend
pnpm install
```

### Añadir una dependencia de producción

```bash
cd frontend
pnpm add axios-retry
```

### Añadir una de desarrollo

```bash
cd frontend
pnpm add -D @types/node
```

### Fijar versión concreta

```bash
pnpm add react@18.3.1
pnpm add "react@^18.3.0"
```

### Actualizar

Todas dentro de rangos declarados:

```bash
pnpm update
```

Una concreta:

```bash
pnpm update axios
```

A la última (rompiendo el rango si hace falta):

```bash
pnpm add axios@latest
```

### Quitar una dep

```bash
pnpm remove paquete
```

### Ver qué está desactualizado

```bash
pnpm outdated
```

### Ejecutar scripts

Los scripts viven en `package.json → scripts`. Atajos:

```bash
pnpm dev            # equivale a pnpm run dev
pnpm test
pnpm lint
pnpm type-check
```

### Importante

> ⚠️ **`pnpm-lock.yaml` siempre se commitea.** Igual que `uv.lock`, garantiza
> instalaciones reproducibles.

---

## Política de actualizaciones (sugerida)

- **Crítico de seguridad**: actualizar **ya**, sin esperar al ciclo.
- **Minor/patch**: cada 2-4 semanas. Generalmente seguro.
- **Major**: leer changelog, abrir PR aparte para que se revise con calma.

### Automatizarlo

Recomendado: **Dependabot** (gratis en GitHub) o **Renovate**. Configuran PRs
automáticos de actualización.

**Setup mínimo con Dependabot** (crea `.github/dependabot.yml`):

```yaml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

> 💡 Dependabot soporta `pip` para `pyproject.toml`. Para `uv.lock` puro
> todavía hay soporte limitado; el ecosystem `pip` actualiza `pyproject.toml`
> y `uv lock` regenera el lockfile en CI.

---

## Siguiente paso

- Cuando una nueva dep requiere una env var nueva → [09-configuration](09-configuration.md).
- Antes de PR pasa el pipeline → [08-code-quality](08-code-quality.md).
