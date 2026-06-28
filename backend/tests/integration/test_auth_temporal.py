"""P3 — auth temporal: master/backup, sesión única, fuerza, logout, expulsión
de backups cuando master entra."""

from __future__ import annotations

from httpx import AsyncClient

from tests.integration._helpers import alta, clear_email_override, login


async def test_login_master_devuelve_roles_y_tipo(client: AsyncClient) -> None:
    fake = await alta(client, "auth-1")
    try:
        h = await login(client, "auth-1", fake, "direccion")
        me = (await client.get("/api/v1/emergencias/auth-1/auth/me", headers=h)).json()
        assert me["tipo"] == "master"
        assert me["roles"] == ["direccion"]
        assert me["usuario_id"] is not None
    finally:
        clear_email_override()


async def test_login_de_otra_emergencia_da_403(client: AsyncClient) -> None:
    fa = await alta(client, "auth-a")
    try:
        ha = await login(client, "auth-a", fa, "seguridad")
        await alta(client, "auth-b")
        r = await client.get("/api/v1/emergencias/auth-b", headers=ha)
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "emergencia_forbidden"
    finally:
        clear_email_override()


async def test_credencial_invalida(client: AsyncClient) -> None:
    await alta(client, "auth-bad")
    try:
        r = await client.post(
            "/api/v1/emergencias/auth-bad/auth/login", json={"token": "999.deadbeef"}
        )
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "bad_credential"
    finally:
        clear_email_override()


async def test_sesion_unica_y_force(client: AsyncClient) -> None:
    fake = await alta(client, "auth-ses")
    try:
        h1 = await login(client, "auth-ses", fake, "seguridad")
        # segundo login con la misma credencial → 409 sesion_activa
        token = fake.token_for("seguridad@x.es")
        r = await client.post("/api/v1/emergencias/auth-ses/auth/login", json={"token": token})
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "sesion_activa"
        # con force=true → 200 (cierra la anterior)
        h2 = await login(client, "auth-ses", fake, "seguridad", force=True)
        # h1 ahora debería estar expulsado (jti antiguo no válido)
        r1 = await client.get("/api/v1/emergencias/auth-ses/auth/me", headers=h1)
        assert r1.status_code == 401
        assert r1.json()["error"]["code"] == "sesion_terminada"
        # h2 sigue OK
        assert (
            await client.get("/api/v1/emergencias/auth-ses/auth/me", headers=h2)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_master_deshabilita_backup(client: AsyncClient) -> None:
    fake = await alta(client, "auth-mb", con_suplentes=True)
    try:
        # backup entra primero (suplente de seguridad)
        h_bk = await login(client, "auth-mb", fake, "seguridad", suffix="sup")
        # backup puede leer
        assert (
            await client.get("/api/v1/emergencias/auth-mb/auth/me", headers=h_bk)
        ).status_code == 200
        # llega el master de seguridad
        h_master = await login(client, "auth-mb", fake, "seguridad")
        # backup queda fuera (sesión cerrada por master_in)
        r = await client.get("/api/v1/emergencias/auth-mb/auth/me", headers=h_bk)
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "sesion_terminada"
        # master OK
        assert (
            await client.get("/api/v1/emergencias/auth-mb/auth/me", headers=h_master)
        ).status_code == 200
    finally:
        clear_email_override()


async def test_logout_reactiva_backups(client: AsyncClient) -> None:
    fake = await alta(client, "auth-lo", con_suplentes=True)
    try:
        h_master = await login(client, "auth-lo", fake, "seguridad")
        # backup deshabilitada → login backup falla
        token_bk = fake.token_for("seguridad-sup@x.es")
        r = await client.post(
            "/api/v1/emergencias/auth-lo/auth/login",
            json={"token": token_bk, "email": "seguridad-sup@x.es"},
        )
        assert r.status_code == 401  # credencial deshabilitada
        # master hace logout
        r = await client.post("/api/v1/emergencias/auth-lo/auth/logout", headers=h_master)
        assert r.status_code == 204
        # ahora backup vuelve a funcionar
        h_bk = await login(client, "auth-lo", fake, "seguridad", suffix="sup")
        assert (
            await client.get("/api/v1/emergencias/auth-lo/auth/me", headers=h_bk)
        ).status_code == 200
    finally:
        clear_email_override()
