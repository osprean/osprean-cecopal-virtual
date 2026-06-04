"""F3 dirección: RBAC (solo jefe), auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login, select_roles

GRUPO = {"tipo": "intervention", "leader": "X", "members_total": 5, "members_active": 4}


async def test_direccion_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "dir-1")
    try:
        op = await login(client, "dir-1", fake, "op@x.es")
        await select_roles(client, "dir-1", op, ["seguridad"])
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
        jefe = await login(client, "dir-2", fake, "jefa@x.es")
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
        jefe = await login(client, "dir-3", fake, "jefa@x.es")
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura = true WHERE email = 'jefa@x.es'")
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


async def test_direccion_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "dir-a")
    try:
        ja = await login(client, "dir-a", fa, "jefa@x.es")
        await client.post("/api/v1/emergencias/dir-a/direccion/grupos", json=GRUPO, headers=ja)
        fb = await alta(client, "dir-b")
        jb = await login(client, "dir-b", fb, "jefa@x.es")
        assert (
            await client.get("/api/v1/emergencias/dir-b/direccion/grupos", headers=jb)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/dir-b/direccion/grupos", headers=ja)
        ).status_code == 403
    finally:
        clear_email_override()
