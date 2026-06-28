"""P9 — notificaciones cross-area."""

from __future__ import annotations

from httpx import AsyncClient

from tests.integration._helpers import alta, clear_email_override, login

NOTIF = {
    "rol_destino": "seguridad",
    "tipo": "perimetro_modificado",
    "mensaje": "Dirección ha movido el perímetro Norte 50m al sur",
    "payload": {"perimetro_id": 7},
}


async def test_solo_direccion_crea_notificacion(client: AsyncClient) -> None:
    fake = await alta(client, "notif-1")
    try:
        seg = await login(client, "notif-1", fake, "seguridad")
        # seguridad NO puede crear
        r = await client.post("/api/v1/emergencias/notif-1/notificaciones", json=NOTIF, headers=seg)
        assert r.status_code == 403
        jefe = await login(client, "notif-1", fake, "direccion")
        r = await client.post(
            "/api/v1/emergencias/notif-1/notificaciones", json=NOTIF, headers=jefe
        )
        assert r.status_code == 201, r.text
        assert r.json()["rol_destino"] == "seguridad"
    finally:
        clear_email_override()


async def test_rol_destino_la_recibe_y_marca_leida(client: AsyncClient) -> None:
    fake = await alta(client, "notif-2")
    try:
        jefe = await login(client, "notif-2", fake, "direccion")
        r = await client.post(
            "/api/v1/emergencias/notif-2/notificaciones", json=NOTIF, headers=jefe
        )
        nid = r.json()["id"]
        # seguridad la ve
        seg = await login(client, "notif-2", fake, "seguridad")
        r = await client.get("/api/v1/emergencias/notif-2/notificaciones", headers=seg)
        assert r.status_code == 200
        notifs = r.json()
        assert any(n["id"] == nid for n in notifs)
        # logística NO la ve (rol distinto)
        log = await login(client, "notif-2", fake, "logistica")
        r = await client.get("/api/v1/emergencias/notif-2/notificaciones", headers=log)
        assert r.json() == []
        # seguridad la marca leída
        r = await client.post(
            f"/api/v1/emergencias/notif-2/notificaciones/{nid}/leida", headers=seg
        )
        assert r.status_code == 200 and r.json()["leida_at"] is not None
    finally:
        clear_email_override()


async def test_polling_since(client: AsyncClient) -> None:
    """Filtro since= devuelve solo notificaciones posteriores."""
    import asyncio

    fake = await alta(client, "notif-3")
    try:
        jefe = await login(client, "notif-3", fake, "direccion")
        r1 = await client.post(
            "/api/v1/emergencias/notif-3/notificaciones", json=NOTIF, headers=jefe
        )
        ts1 = r1.json()["created_at"]
        # Listar con since=ts1 → debería devolver vacío (no hay notifs > ts1).
        seg = await login(client, "notif-3", fake, "seguridad")
        r = await client.get(f"/api/v1/emergencias/notif-3/notificaciones?since={ts1}", headers=seg)
        assert r.json() == []
        # Espera para que la siguiente notificación tenga timestamp > ts1
        # (el filtro server-side usa > estricto).
        await asyncio.sleep(1.1)
        await client.post("/api/v1/emergencias/notif-3/notificaciones", json=NOTIF, headers=jefe)
        r = await client.get(f"/api/v1/emergencias/notif-3/notificaciones?since={ts1}", headers=seg)
        assert len(r.json()) == 1
    finally:
        clear_email_override()
