"""Helpers compartidos para los tests de áreas operativas (F3)."""

from __future__ import annotations

from httpx import AsyncClient

from app.deps import get_email_sender
from app.main import app
from tests.integration.conftest_email import FakeEmailSender

SECRET = {"X-Webhook-Secret": "dev-webhook-secret-change-me"}


async def alta(client: AsyncClient, slug: str, org: int = 1) -> FakeEmailSender:
    """Crea una emergencia con jefe + un participante 'op' (rol genérico)."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    payload = {
        "organization_id": org,
        "slug": slug,
        "modo": "real",
        "participantes": [
            {"nombre": "Jefa", "email": "jefa@x.es", "es_jefe": True},
            {"nombre": "Op", "email": "op@x.es", "es_jefe": False},
        ],
    }
    r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
    assert r.status_code == 201, r.text
    return fake


async def login(
    client: AsyncClient, slug: str, fake: FakeEmailSender, email: str
) -> dict[str, str]:
    token = fake.token_for(email)
    assert token, f"sin token para {email}"
    r = await client.post(f"/api/v1/emergencias/{slug}/auth/login", json={"token": token})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def select_roles(client: AsyncClient, slug: str, headers: dict, roles: list[str]) -> None:
    r = await client.post(
        f"/api/v1/emergencias/{slug}/roles/seleccion", json={"roles": roles}, headers=headers
    )
    assert r.status_code == 200, r.text


def clear_email_override() -> None:
    app.dependency_overrides.pop(get_email_sender, None)
