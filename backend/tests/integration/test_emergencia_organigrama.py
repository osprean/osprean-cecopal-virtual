"""Snapshot del organigrama recibido en el webhook de alta (organigrama_png_b64).

Verifica que el PNG (data URL o base64 pelado) se decodifica y persiste, que el
alta sin organigrama sigue funcionando, y que un base64 corrupto no tumba el alta.
"""

from __future__ import annotations

import base64
from pathlib import Path

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_email_sender
from app.main import app
from app.models.cecovi_emergencia import CecoviEmergencia
from tests.integration._helpers import SECRET, build_payload
from tests.integration.conftest_email import FakeEmailSender

# PNG 1x1 transparente.
_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII="


async def test_alta_guarda_organigrama_png(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        payload = build_payload(slug="organ-1")
        payload["organigrama_png_b64"] = f"data:image/png;base64,{_PNG_B64}"
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 201, r.text

        em = (
            await db_session.execute(
                select(CecoviEmergencia).where(CecoviEmergencia.slug == "organ-1")
            )
        ).scalar_one()
        assert em.organigrama_png_path is not None
        p = Path(em.organigrama_png_path)
        assert p.exists()
        assert p.read_bytes() == base64.b64decode(_PNG_B64)
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_alta_sin_organigrama_ok(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        payload = build_payload(slug="organ-none")  # sin organigrama_png_b64
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 201, r.text
        em = (
            await db_session.execute(
                select(CecoviEmergencia).where(CecoviEmergencia.slug == "organ-none")
            )
        ).scalar_one()
        assert em.organigrama_png_path is None
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_alta_organigrama_b64_corrupto_no_bloquea(client: AsyncClient) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        payload = build_payload(slug="organ-bad")
        payload["organigrama_png_b64"] = "no-es-base64-valido!!!"
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 201, r.text  # el alta no se bloquea
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
