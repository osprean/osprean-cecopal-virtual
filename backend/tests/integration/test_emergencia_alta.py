"""Alta de emergencia por webhook (P3/P4): roles con titular + suplentes,
master/backup, dedupe por comacon_emergency_id, regla rol 'direccion' único."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_email_sender
from app.main import app
from tests.integration._helpers import SECRET, build_payload
from tests.integration.conftest_email import FakeEmailSender


async def test_alta_crea_master_y_backup(client: AsyncClient) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        payload = build_payload(slug="alta-1", con_suplentes=True)
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["n_master"] == 6  # 6 áreas (con `campo` latente)
        assert body["n_backup"] == 6  # 1 backup compartida por rol
        assert body["direccion_usuario_id"] > 0
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_alta_exige_rol_direccion(client: AsyncClient) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        # sin rol "direccion" → 400
        payload = build_payload(slug="alta-nojefe", areas=("seguridad", "sanitario"))
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "direccion_unico_requerido"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_alta_requiere_secreto_webhook(client: AsyncClient) -> None:
    payload = build_payload(slug="alta-nosec")
    r = await client.post("/api/v1/emergencias", json=payload)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "webhook_unauthorized"

    r = await client.post(
        "/api/v1/emergencias", json=payload, headers={"X-Webhook-Secret": "nope"}
    )
    assert r.status_code == 401


async def test_simulacro_envia_emails_con_marca(client: AsyncClient) -> None:
    """En el nuevo modelo, simulacro reutiliza los HRs reales del diagrama del
    plan en COMACON; los emails se envían al rsoter real pero el HTML lleva una
    marca clara de 'EMERGENCIA EN MODO SIMULACRO' para que el destinatario sepa
    que no es real."""
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        payload = build_payload(slug="sim-1")
        payload["modo"] = "simulacro"
        r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
        assert r.status_code == 201
        # Sí se envía a los destinatarios reales: el simulacro lo lanza un
        # operador desde COMACON eligiendo plan+diagrama; el roster es real.
        assert len(fake.sent) > 0
        msg = fake.sent[0]
        # La marca visual del modo viene en el HTML.
        assert msg.html and "SIMULACRO" in msg.html.upper()
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_alta_dedup_comacon_emergency_id(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    try:
        p1 = build_payload(slug="dedup-1")
        p1["comacon_emergency_id"] = 4242
        r1 = await client.post("/api/v1/emergencias", json=p1, headers=SECRET)
        assert r1.status_code == 201
        # 2º intento con MISMO comacon_emergency_id → 409
        p2 = build_payload(slug="dedup-2")
        p2["comacon_emergency_id"] = 4242
        r2 = await client.post("/api/v1/emergencias", json=p2, headers=SECRET)
        assert r2.status_code == 409
        assert r2.json()["error"]["code"] == "comacon_emergency_taken"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
