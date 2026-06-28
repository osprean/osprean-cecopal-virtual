"""F3 dirección: RBAC (solo jefe), auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login

GRUPO = {"tipo": "intervention", "leader": "X", "members_total": 5, "members_active": 4}


async def test_direccion_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "dir-1")
    try:
        op = await login(client, "dir-1", fake, "seguridad")
        # seguridad NO tiene direccion:operar/ver
        assert (
            await client.post("/api/v1/emergencias/dir-1/direccion/grupos", json=GRUPO, headers=op)
        ).status_code == 403
        assert (
            await client.get("/api/v1/emergencias/dir-1/direccion/grupos", headers=op)
        ).status_code == 403
    finally:
        clear_email_override()


async def test_direccion_jefe_opera_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "dir-2")
    try:
        jefe = await login(client, "dir-2", fake, "direccion")
        r = await client.post(
            "/api/v1/emergencias/dir-2/direccion/grupos", json=GRUPO, headers=jefe
        )
        assert r.status_code == 201, r.text
        gid = r.json()["id"]
        r = await client.post(
            f"/api/v1/emergencias/dir-2/direccion/grupos/{gid}/estado",
            json={"estado": "alert"},
            headers=jefe,
        )
        assert r.status_code == 200 and r.json()["estado"] == "alert"
        logs = (await client.get("/api/v1/emergencias/dir-2/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert {"direccion:grupo_creado", "direccion:grupo_estado"} <= acciones
    finally:
        clear_email_override()


async def test_direccion_solo_lectura(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = await alta(client, "dir-3")
    try:
        jefe = await login(client, "dir-3", fake, "direccion")
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura = true WHERE email = 'direccion@x.es'")
        )
        await db_session.commit()
        r = await client.post(
            "/api/v1/emergencias/dir-3/direccion/grupos", json=GRUPO, headers=jefe
        )
        assert r.status_code == 403 and r.json()["error"]["code"] == "solo_lectura"
        assert (
            await client.get("/api/v1/emergencias/dir-3/direccion/grupos", headers=jefe)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_direccion_evacuacion(client: AsyncClient) -> None:
    fake = await alta(client, "dir-ev")
    try:
        jefe = await login(client, "dir-ev", fake, "direccion")
        ev = {
            "name": "Ruta norte",
            "estimated_people": 50,
            "route_points": [{"lat": 39.4, "lng": -0.3}],
        }
        r = await client.post(
            "/api/v1/emergencias/dir-ev/direccion/evacuaciones", json=ev, headers=jefe
        )
        assert r.status_code == 201, r.text
        eid = r.json()["id"]
        assert r.json()["estado"] == "planned"
        r = await client.post(
            f"/api/v1/emergencias/dir-ev/direccion/evacuaciones/{eid}/evacuados",
            json={"evacuated_people": 20},
            headers=jefe,
        )
        assert r.status_code == 200 and r.json()["evacuated_people"] == 20
        acciones = {
            x["accion"]
            for x in (await client.get("/api/v1/emergencias/dir-ev/logs", headers=jefe)).json()
        }
        assert {"direccion:evacuacion_creada", "direccion:evacuacion_evacuados"} <= acciones
    finally:
        clear_email_override()


async def test_direccion_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "dir-a")
    try:
        ja = await login(client, "dir-a", fa, "direccion")
        await client.post("/api/v1/emergencias/dir-a/direccion/grupos", json=GRUPO, headers=ja)
        fb = await alta(client, "dir-b")
        jb = await login(client, "dir-b", fb, "direccion")
        assert (
            await client.get("/api/v1/emergencias/dir-b/direccion/grupos", headers=jb)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/dir-b/direccion/grupos", headers=ja)
        ).status_code == 403
    finally:
        clear_email_override()
