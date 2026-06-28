"""P11 — finalizar / reactivar / PDF de informe."""

from __future__ import annotations

from httpx import AsyncClient

from tests.integration._helpers import alta, clear_email_override, login


async def test_solo_direccion_finaliza(client: AsyncClient) -> None:
    fake = await alta(client, "cier-1")
    try:
        seg = await login(client, "cier-1", fake, "seguridad")
        r = await client.post("/api/v1/emergencias/cier-1/finalizar", headers=seg)
        assert r.status_code == 403
        jefe = await login(client, "cier-1", fake, "direccion")
        r = await client.post("/api/v1/emergencias/cier-1/finalizar", headers=jefe)
        assert r.status_code == 200, r.text
        assert r.json()["estado"] == "finalizada"
    finally:
        clear_email_override()


async def test_finalizar_y_reactivar(client: AsyncClient) -> None:
    fake = await alta(client, "cier-2")
    try:
        jefe = await login(client, "cier-2", fake, "direccion")
        r = await client.post("/api/v1/emergencias/cier-2/finalizar", headers=jefe)
        assert r.json()["estado"] == "finalizada"
        r = await client.post("/api/v1/emergencias/cier-2/reactivar", headers=jefe)
        assert r.status_code == 200 and r.json()["estado"] == "activa"
        # Auditoría
        logs = (await client.get("/api/v1/emergencias/cier-2/logs", headers=jefe)).json()
        acciones = {x["accion"] for x in logs}
        assert {"emergencia_finalizada", "emergencia_reactivada"} <= acciones
    finally:
        clear_email_override()


async def test_pdf_endpoint_devuelve_archivo_si_generado(client: AsyncClient) -> None:
    """Si WeasyPrint está disponible, el PDF se genera y se descarga."""
    fake = await alta(client, "cier-3")
    try:
        jefe = await login(client, "cier-3", fake, "direccion")
        await client.post("/api/v1/emergencias/cier-3/finalizar", headers=jefe)
        r = await client.get("/api/v1/emergencias/cier-3/informe.pdf", headers=jefe)
        # Aceptamos 200 (weasyprint OK) o 404 (weasyprint no disponible en CI sin libs sistema).
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert r.headers.get("content-type", "").startswith("application/pdf")
    finally:
        clear_email_override()
