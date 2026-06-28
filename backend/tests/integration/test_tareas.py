"""P5 — tareas operativas: snapshot al alta, RBAC por rol, ciclo de estado."""

from __future__ import annotations

from httpx import AsyncClient

from tests.integration._helpers import alta, clear_email_override, login


async def test_alta_genera_tareas_por_rol(client: AsyncClient) -> None:
    fake = await alta(client, "tar-1")
    try:
        jefe = await login(client, "tar-1", fake, "direccion")
        r = await client.get("/api/v1/emergencias/tar-1/tareas", headers=jefe)
        assert r.status_code == 200, r.text
        tareas = r.json()
        # Cada rol del seed (direccion/logistica/sanitario/seguridad/gabinete) tiene
        # al menos una placeholder; el jefe las ve todas.
        roles_con_tareas = {t["rol"] for t in tareas}
        assert {"direccion", "logistica", "sanitario", "seguridad", "gabinete"} <= roles_con_tareas
    finally:
        clear_email_override()


async def test_rol_solo_ve_sus_tareas(client: AsyncClient) -> None:
    fake = await alta(client, "tar-2")
    try:
        seg = await login(client, "tar-2", fake, "seguridad")
        r = await client.get("/api/v1/emergencias/tar-2/tareas", headers=seg)
        assert r.status_code == 200
        roles = {t["rol"] for t in r.json()}
        assert roles == {"seguridad"}
    finally:
        clear_email_override()


async def test_ciclo_aceptar_completar(client: AsyncClient) -> None:
    fake = await alta(client, "tar-3")
    try:
        seg = await login(client, "tar-3", fake, "seguridad")
        tareas = (await client.get("/api/v1/emergencias/tar-3/tareas", headers=seg)).json()
        tid = tareas[0]["id"]
        r = await client.post(f"/api/v1/emergencias/tar-3/tareas/{tid}/aceptar", headers=seg)
        assert r.status_code == 200 and r.json()["estado"] == "accepted"
        r = await client.post(f"/api/v1/emergencias/tar-3/tareas/{tid}/completar", headers=seg)
        assert r.status_code == 200 and r.json()["estado"] == "completed"
        # Auditoría
        jefe = await login(client, "tar-3", fake, "direccion")
        logs = (await client.get("/api/v1/emergencias/tar-3/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert {"tarea:aceptada", "tarea:completada"} <= acciones
    finally:
        clear_email_override()


async def test_no_se_puede_completar_tarea_de_otro_rol(client: AsyncClient) -> None:
    fake = await alta(client, "tar-4")
    try:
        seg = await login(client, "tar-4", fake, "seguridad")
        san_tareas = await login(client, "tar-4", fake, "sanitario")
        # Buscar una tarea de sanitario via la sesión de sanitario
        t_san = (await client.get("/api/v1/emergencias/tar-4/tareas", headers=san_tareas)).json()
        tid_san = t_san[0]["id"]
        # seguridad intenta aceptarla → 403
        r = await client.post(f"/api/v1/emergencias/tar-4/tareas/{tid_san}/aceptar", headers=seg)
        assert r.status_code == 403
    finally:
        clear_email_override()


async def test_solo_direccion_cancela(client: AsyncClient) -> None:
    fake = await alta(client, "tar-5")
    try:
        seg = await login(client, "tar-5", fake, "seguridad")
        tareas = (await client.get("/api/v1/emergencias/tar-5/tareas", headers=seg)).json()
        tid = tareas[0]["id"]
        # seguridad NO puede cancelar
        r = await client.post(f"/api/v1/emergencias/tar-5/tareas/{tid}/cancelar", headers=seg)
        assert r.status_code == 403
        # direccion sí
        jefe = await login(client, "tar-5", fake, "direccion")
        r = await client.post(f"/api/v1/emergencias/tar-5/tareas/{tid}/cancelar", headers=jefe)
        assert r.status_code == 200 and r.json()["estado"] == "cancelled"
    finally:
        clear_email_override()
