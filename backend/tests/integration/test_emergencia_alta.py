"""Alta de emergencia vía webhook: jefe único (I1 nunca cero), N credenciales, auth webhook."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_email_sender
from app.main import app
from app.repositories.rol_seleccion_repository import RolSeleccionRepository
from tests.integration.conftest_email import FakeEmailSender

SECRET = {"X-Webhook-Secret": "dev-webhook-secret-change-me"}


def _payload(slug: str, modo: str = "real", *, jefes: int = 1, n: int = 3) -> dict:
    participantes = []
    for i in range(n):
        participantes.append(
            {"nombre": f"P{i}", "email": f"p{i}@x.es", "nivel": "cecopal", "es_jefe": i < jefes}
        )
    return {"organization_id": 1, "slug": slug, "modo": modo, "participantes": participantes}


async def test_alta_crea_emergencia_y_n_credenciales(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    r = await client.post("/api/v1/emergencias", json=_payload("val-1", n=3), headers=SECRET)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["n_credenciales"] == 3
    assert body["jefe_usuario_id"] > 0

    # I1 "nunca cero": la emergencia nace con exactamente un jefe activo.
    jefes = [
        row
        for row in await RolSeleccionRepository(db_session).list_by_emergencia(body["id"])
        if row.rol == "jefe" and row.activo
    ]
    assert len(jefes) == 1
    assert jefes[0].usuario_temporal_id == body["jefe_usuario_id"]


async def test_alta_exige_exactamente_un_jefe(client: AsyncClient) -> None:
    r0 = await client.post("/api/v1/emergencias", json=_payload("val-0j", jefes=0), headers=SECRET)
    assert r0.status_code == 400
    assert r0.json()["error"]["code"] == "jefe_unico_requerido"

    r2 = await client.post("/api/v1/emergencias", json=_payload("val-2j", jefes=2), headers=SECRET)
    assert r2.status_code == 400
    assert r2.json()["error"]["code"] == "jefe_unico_requerido"


async def test_alta_requiere_secreto_webhook(client: AsyncClient) -> None:
    r = await client.post("/api/v1/emergencias", json=_payload("val-nosec"))
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "webhook_unauthorized"

    r = await client.post(
        "/api/v1/emergencias", json=_payload("val-badsec"), headers={"X-Webhook-Secret": "nope"}
    )
    assert r.status_code == 401


async def test_simulacro_no_envia_a_destinatarios_reales(client: AsyncClient) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        r = await client.post(
            "/api/v1/emergencias", json=_payload("sim-1", modo="simulacro"), headers=SECRET
        )
        assert r.status_code == 201
        # Sin SIMULACRO_EMAIL_SINK configurado, no se contacta a nadie real.
        assert fake.sent == []
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
