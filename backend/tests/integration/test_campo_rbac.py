"""F3 campo: RBAC, auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login, select_roles

TAREA = {"code": "T-1", "title": "Reconocer zona", "priority": "high"}


async def test_campo_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "campo-1")
    try:
        op = await login(client, "campo-1", fake, "op@x.es")
        await select_roles(client, "campo-1", op, ["seguridad"])
        assert (
            await client.post("/api/v1/emergencias/campo-1/campo/tareas", json=TAREA, headers=op)
        ).status_code == 403
        assert (
            await client.get("/api/v1/emergencias/campo-1/campo/tareas", headers=op)
        ).status_code == 403
    finally:
        clear_email_override()


async def test_campo_opera_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "campo-2")
    try:
        op = await login(client, "campo-2", fake, "op@x.es")
        await select_roles(client, "campo-2", op, ["campo"])
        r = await client.post("/api/v1/emergencias/campo-2/campo/tareas", json=TAREA, headers=op)
        assert r.status_code == 201, r.text
        tid = r.json()["id"]
        r = await client.post(
            f"/api/v1/emergencias/campo-2/campo/tareas/{tid}/estado",
            json={"estado": "accepted"},
            headers=op,
        )
        assert r.status_code == 200 and r.json()["estado"] == "accepted"
        jefe = await login(client, "campo-2", fake, "jefa@x.es")
        acciones = {
            x["accion"]
            for x in (await client.get("/api/v1/emergencias/campo-2/logs", headers=jefe)).json()
        }
        assert {"campo:tarea_creada", "campo:tarea_estado"} <= acciones
    finally:
        clear_email_override()


async def test_campo_solo_lectura(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = await alta(client, "campo-3")
    try:
        op = await login(client, "campo-3", fake, "op@x.es")
        await select_roles(client, "campo-3", op, ["campo"])
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura=true WHERE email='op@x.es'")
        )
        await db_session.commit()
        r = await client.post("/api/v1/emergencias/campo-3/campo/tareas", json=TAREA, headers=op)
        assert r.status_code == 403 and r.json()["error"]["code"] == "solo_lectura"
        assert (
            await client.get("/api/v1/emergencias/campo-3/campo/tareas", headers=op)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_campo_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "campo-a")
    try:
        oa = await login(client, "campo-a", fa, "op@x.es")
        await select_roles(client, "campo-a", oa, ["campo"])
        await client.post("/api/v1/emergencias/campo-a/campo/tareas", json=TAREA, headers=oa)
        fb = await alta(client, "campo-b")
        ob = await login(client, "campo-b", fb, "op@x.es")
        await select_roles(client, "campo-b", ob, ["campo"])
        assert (
            await client.get("/api/v1/emergencias/campo-b/campo/tareas", headers=ob)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/campo-b/campo/tareas", headers=oa)
        ).status_code == 403
    finally:
        clear_email_override()
