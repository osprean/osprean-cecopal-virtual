"""F3 gabinete: RBAC, auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login, select_roles

CANAL = {"kind": "press", "audience_reach": 1000}


async def test_gabinete_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "gab-1")
    try:
        op = await login(client, "gab-1", fake, "op@x.es")
        await select_roles(client, "gab-1", op, ["seguridad"])
        assert (
            await client.post("/api/v1/emergencias/gab-1/gabinete/canales", json=CANAL, headers=op)
        ).status_code == 403
        assert (
            await client.get("/api/v1/emergencias/gab-1/gabinete/canales", headers=op)
        ).status_code == 403
    finally:
        clear_email_override()


async def test_gabinete_opera_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "gab-2")
    try:
        op = await login(client, "gab-2", fake, "op@x.es")
        await select_roles(client, "gab-2", op, ["gabinete"])
        r = await client.post("/api/v1/emergencias/gab-2/gabinete/canales", json=CANAL, headers=op)
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        r = await client.post(
            f"/api/v1/emergencias/gab-2/gabinete/canales/{cid}/estado",
            json={"estado": "degraded"},
            headers=op,
        )
        assert r.status_code == 200 and r.json()["estado"] == "degraded"
        jefe = await login(client, "gab-2", fake, "jefa@x.es")
        acciones = {
            x["accion"]
            for x in (await client.get("/api/v1/emergencias/gab-2/logs", headers=jefe)).json()
        }
        assert {"gabinete:canal_creado", "gabinete:canal_estado"} <= acciones
    finally:
        clear_email_override()


async def test_gabinete_solo_lectura(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = await alta(client, "gab-3")
    try:
        op = await login(client, "gab-3", fake, "op@x.es")
        await select_roles(client, "gab-3", op, ["gabinete"])
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura=true WHERE email='op@x.es'")
        )
        await db_session.commit()
        r = await client.post("/api/v1/emergencias/gab-3/gabinete/canales", json=CANAL, headers=op)
        assert r.status_code == 403 and r.json()["error"]["code"] == "solo_lectura"
        assert (
            await client.get("/api/v1/emergencias/gab-3/gabinete/canales", headers=op)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_gabinete_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "gab-a")
    try:
        oa = await login(client, "gab-a", fa, "op@x.es")
        await select_roles(client, "gab-a", oa, ["gabinete"])
        await client.post("/api/v1/emergencias/gab-a/gabinete/canales", json=CANAL, headers=oa)
        fb = await alta(client, "gab-b")
        ob = await login(client, "gab-b", fb, "op@x.es")
        await select_roles(client, "gab-b", ob, ["gabinete"])
        assert (
            await client.get("/api/v1/emergencias/gab-b/gabinete/canales", headers=ob)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/gab-b/gabinete/canales", headers=oa)
        ).status_code == 403
    finally:
        clear_email_override()
