"""Resolver de /{idEmergencia}: 404 (no existe) vs 403 (sin credencial)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_emergencia import CecoviEmergencia


async def _crear_emergencia(db: AsyncSession, *, slug: str) -> CecoviEmergencia:
    em = CecoviEmergencia(organization_id=1, slug=slug, modo="real")
    db.add(em)
    await db.commit()
    await db.refresh(em)
    return em


async def test_resolver_404_si_slug_no_existe(client: AsyncClient) -> None:
    r = await client.get("/api/v1/emergencias/no-existe")
    assert r.status_code == 404, r.text
    assert r.json()["error"]["code"] == "emergencia_not_found"


async def test_resolver_403_si_existe_sin_credencial(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _crear_emergencia(db_session, slug="valencia-2026")

    r = await client.get("/api/v1/emergencias/valencia-2026")
    # Existe, pero sin credencial válida para esta emergencia (claim emergencia_id
    # llega en F2). No se revela contenido.
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "emergencia_forbidden"
