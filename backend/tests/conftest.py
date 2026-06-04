"""Fixtures compartidas.

Estrategia:
- Engine async por test (function-scoped). pytest-asyncio crea un event loop
  nuevo por cada test; un engine session-scoped reusaría conexiones atadas al
  loop del primer test ("another operation is in progress" / "attached to a
  different loop"). Por eso el engine es por test.
- Pool según dialecto:
  * SQLite :memory: → StaticPool (una sola conexión por engine). Sin esto, cada
    conexión abriría una base en memoria DISTINTA y el create_all no se vería en
    la sesión ("no such table"). Con engine por test, esa única conexión vive en
    el loop del test, así que no hay reuso cruzado.
  * Postgres → NullPool (no reusar conexiones entre tests/loops).
- DSN configurable via TEST_DATABASE_URL; en local cae a SQLite in-memory para
  no exigir Postgres. En CI se exporta TEST_DATABASE_URL apuntando al servicio.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool, StaticPool

from app import models  # noqa: F401  — registra modelos en metadata
from app.database import Base, get_session
from app.main import app as fastapi_app

TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
_IS_SQLITE = TEST_DB_URL.startswith("sqlite")


@pytest_asyncio.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    kwargs: dict[str, Any] = {"future": True}
    if _IS_SQLITE:
        # Una sola conexión compartida → el :memory: sobrevive entre create_all y
        # la sesión. check_same_thread=False por el worker de aiosqlite.
        kwargs["poolclass"] = StaticPool
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["poolclass"] = NullPool
    eng = create_async_engine(TEST_DB_URL, **kwargs)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    fastapi_app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def user_payload() -> dict[str, str]:
    return {
        "email": "alice@example.com",
        "password": "supersecret123",
        "full_name": "Alice Example",
    }
