#!/usr/bin/env sh
set -eu

# Aplica migraciones pendientes si RUN_MIGRATIONS=1 (por defecto sí).
# En K8s puedes desactivarlo para usar un Job/InitContainer dedicado.
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] alembic upgrade head"
  alembic upgrade head
fi

exec "$@"
