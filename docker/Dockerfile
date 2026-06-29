# syntax=docker/dockerfile:1.7
# =====================================================================
# Stage 1 — Frontend builder (Node + pnpm → bundle estático)
# =====================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY frontend/ ./
RUN pnpm build


# =====================================================================
# Stage 2 — Backend builder (uv → .venv aislado)
# =====================================================================
FROM python:3.12-slim AS backend-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates build-essential \
 && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
 && mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --frozen --no-dev 2>/dev/null || uv sync --no-dev


# =====================================================================
# Stage 3 — Runtime (slim, no root, sin toolchain)
# =====================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    ENV=production \
    FRONTEND_DIST_PATH=/app/frontend/dist

# libpq5: driver Postgres. curl: probes/debug.
# Resto: libs NATIVAS que WeasyPrint carga en runtime (cairo/pango/gdk-pixbuf
# + shared-mime-info + libffi/libxml/libxslt). Sin ellas el endpoint de cierre
# con PDF (POST /{id}/finalizar) revienta al importar weasyprint.
# fonts-dejavu-core: fuentes para que el PDF renderice texto (si no, vacío).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpq5 curl \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 \
      shared-mime-info libffi-dev libxml2-dev libxslt1-dev fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --create-home --home-dir /home/app app

WORKDIR /app

COPY --from=backend-builder /app/.venv /app/.venv
COPY --chown=app:app backend/app ./app
COPY --chown=app:app backend/alembic ./alembic
COPY --chown=app:app backend/alembic.ini ./alembic.ini

COPY --from=frontend-builder --chown=app:app /app/dist /app/frontend/dist

COPY --chown=app:app docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health/ready || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# --no-access-log evita duplicar logs: el middleware structlog ya loguea cada request
# en JSON; el access log de uvicorn imprime texto plano y rompe la salida JSON.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
