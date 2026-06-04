"""F3 logística: RBAC, auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login, select_roles

SUM = {"category": "water", "name": "Agua 1.5L", "unit": "pack", "stock": 100, "min_stock": 20}


async def test_logistica_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "logi-1")
    try:
        op = await login(client, "logi-1", fake, "op@x.es")
        await select_roles(client, "logi-1", op, ["seguridad"])
        assert (
            await client.post(
                "/api/v1/emergencias/logi-1/logistica/suministros", json=SUM, headers=op
            )
        ).status_code == 403
        assert (
            await client.get("/api/v1/emergencias/logi-1/logistica/suministros", headers=op)
        ).status_code == 403
    finally:
        clear_email_override()


async def test_logistica_opera_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "logi-2")
    try:
        op = await login(client, "logi-2", fake, "op@x.es")
        await select_roles(client, "logi-2", op, ["logistica"])
        r = await client.post(
            "/api/v1/emergencias/logi-2/logistica/suministros", json=SUM, headers=op
        )
        assert r.status_code == 201, r.text
        sid = r.json()["id"]
        r = await client.post(
            f"/api/v1/emergencias/logi-2/logistica/suministros/{sid}/stock",
            json={"delta": -30},
            headers=op,
        )
        assert r.status_code == 200 and r.json()["stock"] == 70
        jefe = await login(client, "logi-2", fake, "jefa@x.es")
        acciones = {
            x["accion"]
            for x in (await client.get("/api/v1/emergencias/logi-2/logs", headers=jefe)).json()
        }
        assert {"logistica:suministro_creado", "logistica:stock_ajustado"} <= acciones
    finally:
        clear_email_override()


async def test_logistica_solo_lectura(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = await alta(client, "logi-3")
    try:
        op = await login(client, "logi-3", fake, "op@x.es")
        await select_roles(client, "logi-3", op, ["logistica"])
        await db_session.execute(
            text("UPDATE cecovi_usuario_temporal SET solo_lectura=true WHERE email='op@x.es'")
        )
        await db_session.commit()
        r = await client.post(
            "/api/v1/emergencias/logi-3/logistica/suministros", json=SUM, headers=op
        )
        assert r.status_code == 403 and r.json()["error"]["code"] == "solo_lectura"
        assert (
            await client.get("/api/v1/emergencias/logi-3/logistica/suministros", headers=op)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_logistica_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "logi-a")
    try:
        oa = await login(client, "logi-a", fa, "op@x.es")
        await select_roles(client, "logi-a", oa, ["logistica"])
        await client.post("/api/v1/emergencias/logi-a/logistica/suministros", json=SUM, headers=oa)
        fb = await alta(client, "logi-b")
        ob = await login(client, "logi-b", fb, "op@x.es")
        await select_roles(client, "logi-b", ob, ["logistica"])
        assert (
            await client.get("/api/v1/emergencias/logi-b/logistica/suministros", headers=ob)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/logi-b/logistica/suministros", headers=oa)
        ).status_code == 403
    finally:
        clear_email_override()
