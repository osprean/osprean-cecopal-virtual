# 01 — Getting Started

Esta guía deja la plantilla funcionando en tu máquina desde cero. Tras leerla,
deberías ver el login del frontend en `http://localhost:5173`.

Si no conoces alguna herramienta (uv, pnpm, FastAPI, Vite…), pásate primero por
[00-stack-overview](00-stack-overview.md).

---

## Pre-requisitos del sistema

Necesitas:

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Python | 3.12 | `uv` puede instalarlo por ti si no lo tienes |
| Node.js | 20 | |
| Docker + Docker Compose v2 | — | Para Postgres local |
| `uv` | ≥ 0.4 | Gestor de paquetes Python |
| `pnpm` | ≥ 9 | Gestor de paquetes JS |
| Git, make, curl | — | Estándar |

### Instalación en macOS

```bash
# Homebrew (si no lo tienes): https://brew.sh
brew install python@3.12 node@20 docker make

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# pnpm (recomendado vía corepack, que viene con Node 20)
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

Asegúrate de que Docker Desktop está corriendo (icono en la barra de menús).

### Instalación en Linux (Ubuntu/Debian)

```bash
# Python 3.12 (en Ubuntu 24.04 viene por defecto; en 22.04 usa deadsnakes)
sudo apt update && sudo apt install -y python3.12 python3.12-venv make curl git

# Node 20 (vía nvm o nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker engine + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # logout/login después
sudo apt install -y docker-compose-plugin

# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# pnpm
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

### Verificar

```bash
python3.12 --version
node --version
docker --version
docker compose version
uv --version
pnpm --version
```

---

## Crear un repo a partir de la plantilla

### Caso 1 (recomendado): "Use this template" en GitHub

1. Entra al repo de la plantilla en GitHub.
2. Botón verde **Use this template** → **Create a new repository**.
3. Elige nombre del nuevo producto (p. ej. `osprean-foobar`), visibilidad, etc.
4. Clónalo:

```bash
git clone git@github.com:tu-org/osprean-foobar.git
cd osprean-foobar
```

Ventaja: empiezas con historial de Git limpio y la conexión al remoto ya hecha.

### Caso 2: Clonar y resetear historial manualmente

Si no usas GitHub o no tienes acceso a "Use this template":

```bash
git clone <url-de-la-plantilla> osprean-foobar
cd osprean-foobar
rm -rf .git
git init
git add .
git commit -m "Initial commit from osprean-webapp-template"
# Después conecta el remote:
# git remote add origin git@github.com:tu-org/osprean-foobar.git
# git push -u origin main
```

---

## Setup inicial paso a paso

### 1) Variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y cambia al menos:

- `JWT_SECRET_KEY` — genera uno fuerte:

  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(64))"
  ```

El resto de valores por defecto sirven para desarrollo. Lista completa en
[09-configuration](09-configuration.md).

> ⚠️ `.env` está en `.gitignore`. **Nunca** lo commitees.

### 2) Instalar dependencias

```bash
make install
```

Esto ejecuta:

- `cd backend && uv sync` → crea `backend/.venv/` con las deps de
  `backend/pyproject.toml` (resolviendo `uv.lock`).
- `cd frontend && pnpm install` → instala deps en `frontend/node_modules/`
  (resolviendo `frontend/pnpm-lock.yaml`).

La primera vez puede tardar 30-60 s. Las siguientes son casi instantáneas.

### 3) Levantar PostgreSQL en Docker

```bash
make db-up
```

Esto arranca `postgres:16-alpine` en `localhost:5432` con un volumen persistente.
Para los logs: `make db-logs`. Para parar: `make db-down`.

### 4) Aplicar migraciones

```bash
make migrate
```

Equivale a `cd backend && uv run alembic upgrade head`. La migración inicial
(`backend/alembic/versions/2026_01_01_0000-0001_initial.py`) crea las tablas
`users` e `items`.

### 5) Arrancar back y front

En una terminal:

```bash
make backend-dev
```

Verás algo como:

```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

En otra terminal:

```bash
make frontend-dev
```

Verás:

```
VITE v5.x  ready in 200 ms
➜  Local:   http://localhost:5173/
```

### 6) Probar la app

1. Abre <http://localhost:5173>.
2. Verás la pantalla de login.
3. No hay usuarios todavía: regístrate con cURL o con la doc interactiva de
   FastAPI (`http://localhost:8000/docs` → `POST /api/v1/auth/register`):

   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
        -H "Content-Type: application/json" \
        -d '{"email":"yo@example.com","password":"superseguro123","full_name":"Yo"}'
   ```

4. Vuelve al frontend, entra con esas credenciales.
5. Deberías ver la lista de items (vacía) y poder crear uno.

---

## Checklist: "ya está listo"

Marca todo esto y estás operativo:

- [ ] `make db-up` deja Postgres en `:5432`.
- [ ] `make backend-dev` muestra `Application startup complete.`
- [ ] `curl http://localhost:8000/health/live` devuelve `{"status":"ok"}`.
- [ ] `curl http://localhost:8000/health/ready` devuelve
      `{"status":"ok","db":"up"}`.
- [ ] `http://localhost:8000/docs` carga el Swagger.
- [ ] `make frontend-dev` muestra `Local: http://localhost:5173`.
- [ ] Puedes registrarte y entrar desde el frontend.
- [ ] `make test` pasa (corre tests backend + frontend).

---

## Siguiente paso

Sigue con [02-local-development](02-local-development.md) para conocer el
flujo de trabajo diario.
