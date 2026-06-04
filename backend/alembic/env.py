"""Alembic env async + autogenerate."""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app import models  # noqa: F401  — registra modelos en metadata
from app.config import get_settings
from app.database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

# --- Aislamiento de CECOVI sobre la DB compartida con COMACON ---
# CECOVI solo migra sus tablas `cecovi_*`. NUNCA crea/altera/borra tablas de
# COMACON aunque vivan en la misma base. Ver skill `db-migration`.
CECOVI_TABLE_PREFIX = "cecovi_"
# Cadena de versiones propia, separada de la de COMACON (`alembic_version`).
CECOVI_VERSION_TABLE = "alembic_version_cecovi"


def include_object(obj, name, type_, reflected, compare_to):  # noqa: ANN001, ANN201
    """Solo deja pasar tablas `cecovi_*` (e índices/columnas que cuelgan de ellas)."""
    if type_ == "table":
        return name.startswith(CECOVI_TABLE_PREFIX)
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        version_table=CECOVI_VERSION_TABLE,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        version_table=CECOVI_VERSION_TABLE,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    cfg_section = config.get_section(config.config_ini_section, {})
    connectable = async_engine_from_config(
        cfg_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
