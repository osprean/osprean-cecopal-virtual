"""Login temporal (cierra el 403 del resolver) + selección de roles inmutable (I4)."""

from __future__ import annotations

from httpx import AsyncClient

from app.deps import get_email_sender
from app.main import app
from tests.integration.conftest_email import FakeEmailSender

SECRET = {"X-Webhook-Secret": "dev-webhook-secret-change-me"}


async def _alta(client: AsyncClient, slug: str) -> FakeEmailSender:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    payload = {
        "organization_id": 1,
        "slug": slug,
        "modo": "real",
        "participantes": [
            {"nombre": "Jefa", "email": "jefa@x.es", "nivel": "cecopal", "es_jefe": True},
            {
                "nombre": "Conc",
                "email": "conc@x.es",
                "telefono": "+34600000001",
                "nivel": "cecopal",
                "es_jefe": False,
            },
        ],
    }
    r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
    assert r.status_code == 201, r.text
    return fake


async def _login(client: AsyncClient, slug: str, token: str) -> str:
    r = await client.post(f"/api/v1/emergencias/{slug}/auth/login", json={"token": token})
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


async def test_login_cierra_403_del_resolver(client: AsyncClient) -> None:
    fake = await _alta(client, "tx-1")
    try:
        # F1: sin credencial → 403.
        r = await client.get("/api/v1/emergencias/tx-1")
        assert r.status_code == 403

        token = fake.token_for("jefa@x.es")
        assert token is not None
        access = await _login(client, "tx-1", token)

        # Con el JWT (claim emergencia_id) el resolver concede acceso.
        r = await client.get(
            "/api/v1/emergencias/tx-1", headers={"Authorization": f"Bearer {access}"}
        )
        assert r.status_code == 200, r.text
        assert r.json()["slug"] == "tx-1"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_token_de_otra_emergencia_da_403(client: AsyncClient) -> None:
    fake_a = await _alta(client, "tx-a")
    await _alta(client, "tx-b")  # sobrescribe override, da igual: solo necesitamos que exista
    try:
        token_a = fake_a.token_for("jefa@x.es")
        assert token_a is not None
        access_a = await _login(client, "tx-a", token_a)
        # Token de tx-a contra la ruta tx-b → 403 (aislamiento).
        r = await client.get(
            "/api/v1/emergencias/tx-b", headers={"Authorization": f"Bearer {access_a}"}
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "emergencia_forbidden"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_login_credencial_invalida(client: AsyncClient) -> None:
    await _alta(client, "tx-bad")
    try:
        r = await client.post(
            "/api/v1/emergencias/tx-bad/auth/login", json={"token": "999.deadbeef"}
        )
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "bad_credential"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_seleccion_roles_libre_y_luego_inmutable(client: AsyncClient) -> None:
    fake = await _alta(client, "tx-roles")
    try:
        token = fake.token_for("conc@x.es")
        assert token is not None
        access = await _login(client, "tx-roles", token)
        h = {"Authorization": f"Bearer {access}"}

        # Primer acceso: aún no confirmados.
        me = (await client.get("/api/v1/emergencias/tx-roles/auth/me", headers=h)).json()
        assert me["roles_confirmados"] is False
        assert me["roles"] == []
        # telefono fluye webhook → cecovi_usuario_temporal → /me.
        assert me["telefono"] == "+34600000001"

        # Elige libremente varios roles.
        r = await client.post(
            "/api/v1/emergencias/tx-roles/roles/seleccion",
            json={"roles": ["seguridad", "logistica"]},
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert set(r.json()["roles"]) == {"seguridad", "logistica"}
        assert r.json()["roles_confirmados"] is True

        # I4: tras confirmar, inmutable → 409.
        r = await client.post(
            "/api/v1/emergencias/tx-roles/roles/seleccion",
            json={"roles": ["sanitario"]},
            headers=h,
        )
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "roles_inmutables"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_no_se_puede_elegir_jefe(client: AsyncClient) -> None:
    fake = await _alta(client, "tx-nojefe")
    try:
        token = fake.token_for("conc@x.es")
        assert token is not None
        access = await _login(client, "tx-nojefe", token)
        r = await client.post(
            "/api/v1/emergencias/tx-nojefe/roles/seleccion",
            json={"roles": ["jefe"]},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "rol_no_seleccionable"
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
