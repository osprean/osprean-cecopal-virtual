"""F3 — operación de seguridad: RBAC (require_perm), tenancy (I6), log (I7),
solo_lectura (I3) y lectura de recursos COMACON acotada por org."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_email_sender
from app.main import app
from tests.integration.conftest_email import FakeEmailSender

SECRET = {"X-Webhook-Secret": "dev-webhook-secret-change-me"}
PERIM = {
    "kind": "exclusion",
    "label": "Zona 1",
    "shape": "polygon",
    "points": [{"lat": 39.4, "lng": -0.3}],
}


async def _alta(client: AsyncClient, slug: str, org: int = 1) -> FakeEmailSender:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    payload = {
        "organization_id": org,
        "slug": slug,
        "modo": "real",
        "participantes": [
            {"nombre": "Jefa", "email": "jefa@x.es", "es_jefe": True},
            {"nombre": "Seg", "email": "seg@x.es", "es_jefe": False},
            {"nombre": "San", "email": "san@x.es", "es_jefe": False},
        ],
    }
    r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
    assert r.status_code == 201, r.text
    return fake


async def _login(
    client: AsyncClient, slug: str, fake: FakeEmailSender, email: str
) -> dict[str, str]:
    token = fake.token_for(email)
    assert token, f"sin token para {email}"
    r = await client.post(f"/api/v1/emergencias/{slug}/auth/login", json={"token": token})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _select(client: AsyncClient, slug: str, headers: dict, roles: list[str]) -> None:
    r = await client.post(
        f"/api/v1/emergencias/{slug}/roles/seleccion", json={"roles": roles}, headers=headers
    )
    assert r.status_code == 200, r.text


async def test_seguridad_403_sin_permiso(client: AsyncClient) -> None:
    fake = await _alta(client, "rbac-1")
    try:
        san = await _login(client, "rbac-1", fake, "san@x.es")
        await _select(client, "rbac-1", san, ["sanitario"])
        # sanitario NO tiene seguridad:operar → 403
        r = await client.post(
            "/api/v1/emergencias/rbac-1/seguridad/perimetros", json=PERIM, headers=san
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "forbidden_perm"
        # ni seguridad:ver
        r = await client.get("/api/v1/emergencias/rbac-1/seguridad/perimetros", headers=san)
        assert r.status_code == 403
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_seguridad_operar_crea_y_audita(client: AsyncClient) -> None:
    fake = await _alta(client, "rbac-2")
    try:
        seg = await _login(client, "rbac-2", fake, "seg@x.es")
        await _select(client, "rbac-2", seg, ["seguridad"])
        r = await client.post(
            "/api/v1/emergencias/rbac-2/seguridad/perimetros", json=PERIM, headers=seg
        )
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        assert r.json()["estado"] == "active"
        # listado lo devuelve
        r = await client.get("/api/v1/emergencias/rbac-2/seguridad/perimetros", headers=seg)
        assert any(p["id"] == pid for p in r.json())
        # cambio de estado
        r = await client.post(
            f"/api/v1/emergencias/rbac-2/seguridad/perimetros/{pid}/estado",
            json={"estado": "lifted"},
            headers=seg,
        )
        assert r.status_code == 200 and r.json()["estado"] == "lifted"
        # I7: el jefe ve el log con las acciones
        jefe = await _login(client, "rbac-2", fake, "jefa@x.es")
        logs = (await client.get("/api/v1/emergencias/rbac-2/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert "seguridad:perimetro_creado" in acciones
        assert "seguridad:perimetro_estado" in acciones
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_seguridad_solo_lectura_bloquea_escritura(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    fake = await _alta(client, "rbac-3")
    try:
        seg = await _login(client, "rbac-3", fake, "seg@x.es")
        await _select(client, "rbac-3", seg, ["seguridad"])
        # marcar al usuario en solo lectura (I3) — lo que hará F4 al transferir
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura = true WHERE email = 'seg@x.es'")
        )
        await db_session.commit()
        r = await client.post(
            "/api/v1/emergencias/rbac-3/seguridad/perimetros", json=PERIM, headers=seg
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "solo_lectura"
        # pero LEER sigue permitido
        r = await client.get("/api/v1/emergencias/rbac-3/seguridad/perimetros", headers=seg)
        assert r.status_code == 200
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_logs_solo_jefe(client: AsyncClient) -> None:
    fake = await _alta(client, "rbac-4")
    try:
        seg = await _login(client, "rbac-4", fake, "seg@x.es")
        await _select(client, "rbac-4", seg, ["seguridad"])
        # seguridad NO tiene logs:ver
        assert (await client.get("/api/v1/emergencias/rbac-4/logs", headers=seg)).status_code == 403
        jefe = await _login(client, "rbac-4", fake, "jefa@x.es")
        assert (
            await client.get("/api/v1/emergencias/rbac-4/logs", headers=jefe)
        ).status_code == 200
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_tenancy_aislamiento_entre_emergencias(client: AsyncClient) -> None:
    fa = await _alta(client, "rbac-a")
    try:
        sa = await _login(client, "rbac-a", fa, "seg@x.es")
        await _select(client, "rbac-a", sa, ["seguridad"])
        await client.post("/api/v1/emergencias/rbac-a/seguridad/perimetros", json=PERIM, headers=sa)
        fb = await _alta(client, "rbac-b")
        sb = await _login(client, "rbac-b", fb, "seg@x.es")
        await _select(client, "rbac-b", sb, ["seguridad"])
        # token de B no ve perímetros de A (I6); su lista está vacía
        rb = await client.get("/api/v1/emergencias/rbac-b/seguridad/perimetros", headers=sb)
        assert rb.json() == []
        # y token de A contra ruta B → 403 (claim emergencia_id distinto)
        ra = await client.get("/api/v1/emergencias/rbac-b/seguridad/perimetros", headers=sa)
        assert ra.status_code == 403
    finally:
        app.dependency_overrides.pop(get_email_sender, None)


async def test_recursos_comacon_solo_lectura_acotado_por_org(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Stub de la tabla COMACON inventory_element (no está en el metadata de CECOVI).
    await db_session.execute(
        text(
            "CREATE TABLE IF NOT EXISTS inventory_element ("
            "resource_id INTEGER PRIMARY KEY, name VARCHAR, status VARCHAR, "
            "kind VARCHAR, organization_id INTEGER)"
        )
    )
    await db_session.execute(text("DELETE FROM inventory_element"))
    await db_session.execute(
        text(
            "INSERT INTO inventory_element (resource_id,name,status,kind,organization_id) VALUES "
            "(1,'Camion A','available','transport_resource',1),"
            "(2,'Brigada B','assigned','human_resource',1),"
            "(3,'Ajeno','available','human_resource',2)"
        )
    )
    await db_session.commit()
    fake = await _alta(client, "rec-1", org=1)
    try:
        seg = await _login(client, "rec-1", fake, "seg@x.es")
        await _select(client, "rec-1", seg, ["seguridad"])
        r = await client.get("/api/v1/emergencias/rec-1/recursos", headers=seg)
        assert r.status_code == 200, r.text
        nombres = sorted(x["name"] for x in r.json())
        assert nombres == ["Brigada B", "Camion A"]  # solo org 1, NO 'Ajeno' (org 2)
    finally:
        app.dependency_overrides.pop(get_email_sender, None)
        await db_session.execute(text("DROP TABLE IF EXISTS inventory_element"))
        await db_session.commit()
