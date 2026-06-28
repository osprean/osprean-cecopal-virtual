"""P10 — transferencia manual de rol."""

from __future__ import annotations

from httpx import AsyncClient

from tests.integration._helpers import alta, clear_email_override, login


async def test_transferir_invalida_origen_y_crea_destino(client: AsyncClient) -> None:
    fake = await alta(client, "trans-1")
    try:
        h = await login(client, "trans-1", fake, "seguridad")
        r = await client.post(
            "/api/v1/emergencias/trans-1/auth/transferir",
            headers=h,
            json={"nombre": "Roberto", "email": "roberto@x.es", "motivo": "voy al hospital"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["credencial_origen_id"] != body["credencial_nueva_id"]
        # La sesión del transferente queda terminada (jti revocado)
        r2 = await client.get("/api/v1/emergencias/trans-1/auth/me", headers=h)
        assert r2.status_code == 401
        # El nuevo destinatario recibe email con token
        token_nuevo = fake.token_for("roberto@x.es")
        assert token_nuevo, "no llegó token al destinatario"
        # Login con el token nuevo
        r = await client.post(
            "/api/v1/emergencias/trans-1/auth/login",
            json={"token": token_nuevo},
        )
        assert r.status_code == 200
        assert r.json()["roles"] == ["seguridad"]
        # Auditoría
        jefe = await login(client, "trans-1", fake, "direccion")
        logs = (await client.get("/api/v1/emergencias/trans-1/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert "rol_transferido" in acciones
    finally:
        clear_email_override()


async def test_transferir_credencial_origen_revocada(client: AsyncClient) -> None:
    """Tras transferir, la credencial origen queda revocada (no permite re-login)."""
    fake = await alta(client, "trans-2")
    try:
        h = await login(client, "trans-2", fake, "seguridad")
        token_origen = fake.token_for("seguridad@x.es")
        await client.post(
            "/api/v1/emergencias/trans-2/auth/transferir",
            headers=h,
            json={"nombre": "X", "email": "x@x.es", "motivo": "test"},
        )
        # Reintentar login con el token origen → debe fallar.
        r = await client.post(
            "/api/v1/emergencias/trans-2/auth/login", json={"token": token_origen}
        )
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "credential_revoked"
    finally:
        clear_email_override()
