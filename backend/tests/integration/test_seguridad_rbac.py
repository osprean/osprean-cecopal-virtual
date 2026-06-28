"""F3 — operación de seguridad: RBAC (require_perm), tenancy (I6), log (I7),
solo_lectura (I3) y lectura de recursos COMACON acotada por org."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login

PERIM = {
    "kind": "exclusion",
    "label": "Zona 1",
    "shape": "polygon",
    "points": [{"lat": 39.4, "lng": -0.3}],
}


async def test_seguridad_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "rbac-1")
    try:
        # sanitario NO tiene seguridad:operar → 403
        san = await login(client, "rbac-1", fake, "sanitario")
        r = await client.post(
            "/api/v1/emergencias/rbac-1/seguridad/perimetros", json=PERIM, headers=san
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "forbidden_perm"
        # ni seguridad:ver
        r = await client.get("/api/v1/emergencias/rbac-1/seguridad/perimetros", headers=san)
        assert r.status_code == 403
    finally:
        clear_email_override()


async def test_seguridad_operar_crea_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "rbac-2")
    try:
        seg = await login(client, "rbac-2", fake, "seguridad")
        r = await client.post(
            "/api/v1/emergencias/rbac-2/seguridad/perimetros", json=PERIM, headers=seg
        )
        assert r.status_code == 201, r.text
        pid = r.json()["id"]
        assert r.json()["estado"] == "active"
        r = await client.get("/api/v1/emergencias/rbac-2/seguridad/perimetros", headers=seg)
        assert any(p["id"] == pid for p in r.json())
        r = await client.post(
            f"/api/v1/emergencias/rbac-2/seguridad/perimetros/{pid}/estado",
            json={"estado": "lifted"},
            headers=seg,
        )
        assert r.status_code == 200 and r.json()["estado"] == "lifted"
        # I7: el jefe ve el log con las acciones
        jefe = await login(client, "rbac-2", fake, "direccion")
        logs = (await client.get("/api/v1/emergencias/rbac-2/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert "seguridad:perimetro_creado" in acciones
        assert "seguridad:perimetro_estado" in acciones
    finally:
        clear_email_override()


async def test_seguridad_solo_lectura_bloquea_escritura(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    fake = await alta(client, "rbac-3")
    try:
        seg = await login(client, "rbac-3", fake, "seguridad")
        # marcar al titular de seguridad como solo_lectura (I3)
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura = true WHERE email = 'seguridad@x.es'")
        )
        await db_session.commit()
        r = await client.post(
            "/api/v1/emergencias/rbac-3/seguridad/perimetros", json=PERIM, headers=seg
        )
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "solo_lectura"
        # leer sigue OK
        r = await client.get("/api/v1/emergencias/rbac-3/seguridad/perimetros", headers=seg)
        assert r.status_code == 200
    finally:
        clear_email_override()


async def test_logs_solo_jefe(client: AsyncClient) -> None:
    fake = await alta(client, "rbac-4")
    try:
        seg = await login(client, "rbac-4", fake, "seguridad")
        assert (
            await client.get("/api/v1/emergencias/rbac-4/logs", headers=seg)
        ).status_code == 403
        jefe = await login(client, "rbac-4", fake, "direccion")
        assert (
            await client.get("/api/v1/emergencias/rbac-4/logs", headers=jefe)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_tenancy_aislamiento_entre_emergencias(client: AsyncClient) -> None:
    fa = await alta(client, "rbac-a")
    try:
        sa = await login(client, "rbac-a", fa, "seguridad")
        await client.post("/api/v1/emergencias/rbac-a/seguridad/perimetros", json=PERIM, headers=sa)
        fb = await alta(client, "rbac-b")
        sb = await login(client, "rbac-b", fb, "seguridad")
        rb = await client.get("/api/v1/emergencias/rbac-b/seguridad/perimetros", headers=sb)
        assert rb.json() == []
        # token de A contra ruta B → 403 (claim emergencia_id distinto)
        ra = await client.get("/api/v1/emergencias/rbac-b/seguridad/perimetros", headers=sa)
        assert ra.status_code == 403
    finally:
        clear_email_override()


async def test_recursos_comacon_solo_lectura_acotado_por_org(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Stub que imita el esquema real de COMACON con columna `localization`
    # (geometry POINT 4326). El repo usa ST_X/ST_Y en dialect postgresql.
    await db_session.execute(text("DROP TABLE IF EXISTS inventory_element"))
    await db_session.commit()
    await db_session.execute(
        text(
            "CREATE TABLE inventory_element ("
            "resource_id INTEGER PRIMARY KEY, name VARCHAR, status VARCHAR, "
            "kind VARCHAR, organization_id INTEGER, "
            "localization GEOMETRY(POINT,4326))"
        )
    )
    await db_session.execute(text("DELETE FROM inventory_element"))
    await db_session.execute(
        text(
            "INSERT INTO inventory_element "
            "(resource_id,name,status,kind,organization_id,localization) VALUES "
            "(1,'Camion A','available','transport_resource',1,"
            "ST_SetSRID(ST_MakePoint(-0.37, 39.47),4326)),"
            "(2,'Brigada B','assigned','human_resource',1,"
            "ST_SetSRID(ST_MakePoint(-0.38, 39.48),4326)),"
            "(3,'Ajeno','available','human_resource',2,"
            "ST_SetSRID(ST_MakePoint(-3.0, 40.0),4326))"
        )
    )
    await db_session.commit()
    fake = await alta(client, "rec-1", org=1)
    try:
        seg = await login(client, "rec-1", fake, "seguridad")
        r = await client.get("/api/v1/emergencias/rec-1/recursos", headers=seg)
        assert r.status_code == 200, r.text
        recursos = r.json()
        nombres = sorted(x["name"] for x in recursos)
        assert nombres == ["Brigada B", "Camion A"]  # solo org 1, NO 'Ajeno' (org 2)
        camion = next(x for x in recursos if x["name"] == "Camion A")
        assert camion["lat"] == 39.47 and camion["lng"] == -0.37
    finally:
        clear_email_override()
        await db_session.execute(text("DROP TABLE IF EXISTS inventory_element"))
        await db_session.commit()
