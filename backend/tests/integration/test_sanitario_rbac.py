"""F3 sanitario: RBAC, auditoría (I7), solo_lectura (I3), aislamiento (I6)."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration._helpers import alta, clear_email_override, login

VIC = {"code": "VIC-1", "triage": "yellow", "lat": 39.4, "lng": -0.3}


async def test_sanitario_403_sin_permiso(client: AsyncClient) -> None:
    fake = await alta(client, "san-1")
    try:
        op = await login(client, "san-1", fake, "seguridad")  # no sanitario
        assert (
            await client.post("/api/v1/emergencias/san-1/sanitario/victimas", json=VIC, headers=op)
        ).status_code == 403
        assert (
            await client.get("/api/v1/emergencias/san-1/sanitario/victimas", headers=op)
        ).status_code == 403
    finally:
        clear_email_override()


async def test_sanitario_opera_y_audita(client: AsyncClient) -> None:
    fake = await alta(client, "san-2")
    try:
        op = await login(client, "san-2", fake, "sanitario")
        r = await client.post("/api/v1/emergencias/san-2/sanitario/victimas", json=VIC, headers=op)
        assert r.status_code == 201, r.text
        vid = r.json()["id"]
        r = await client.post(
            f"/api/v1/emergencias/san-2/sanitario/victimas/{vid}/triaje",
            json={"triage": "red"},
            headers=op,
        )
        assert r.status_code == 200 and r.json()["triage"] == "red"
        jefe = await login(client, "san-2", fake, "direccion")
        acciones = {
            x["accion"]
            for x in (await client.get("/api/v1/emergencias/san-2/logs", headers=jefe)).json()
        }
        assert {"sanitario:victima_registrada", "sanitario:triaje_actualizado"} <= acciones
    finally:
        clear_email_override()


async def test_sanitario_solo_lectura(client: AsyncClient, db_session: AsyncSession) -> None:
    fake = await alta(client, "san-3")
    try:
        op = await login(client, "san-3", fake, "sanitario")
        await db_session.execute(
            text(
                "UPDATE cecovi_usuario_temporal SET solo_lectura=true WHERE email='sanitario@x.es'"
            )
        )
        await db_session.commit()
        r = await client.post("/api/v1/emergencias/san-3/sanitario/victimas", json=VIC, headers=op)
        assert r.status_code == 403 and r.json()["error"]["code"] == "solo_lectura"
        assert (
            await client.get("/api/v1/emergencias/san-3/sanitario/victimas", headers=op)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_sanitario_aislamiento(client: AsyncClient) -> None:
    fa = await alta(client, "san-a")
    try:
        oa = await login(client, "san-a", fa, "sanitario")
        await client.post("/api/v1/emergencias/san-a/sanitario/victimas", json=VIC, headers=oa)
        fb = await alta(client, "san-b")
        ob = await login(client, "san-b", fb, "sanitario")
        assert (
            await client.get("/api/v1/emergencias/san-b/sanitario/victimas", headers=ob)
        ).json() == []
        assert (
            await client.get("/api/v1/emergencias/san-b/sanitario/victimas", headers=oa)
        ).status_code == 403
    finally:
        clear_email_override()
