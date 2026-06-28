"""Helpers compartidos para los tests de áreas operativas (refactor P3).

Cambios:
- El alta usa el nuevo contrato `roles` (titular + suplentes por rol).
- `alta(slug, areas=("direccion","seguridad","sanitario","logistica","gabinete"))`
  crea por defecto las 5 áreas con un titular único por rol (email distinto).
- `login(slug, fake, rol)` resuelve la credencial master por rol (no por email)
  y la usa para el login; devuelve los headers Authorization.
- `select_roles` se elimina (los roles vienen de la credencial).
"""

from __future__ import annotations

from httpx import AsyncClient

from app.deps import get_email_sender
from app.main import app
from tests.integration.conftest_email import FakeEmailSender

SECRET = {"X-Webhook-Secret": "dev-webhook-secret-change-me"}
ALL_AREAS = ("direccion", "seguridad", "sanitario", "logistica", "gabinete", "campo")


def _participante(area: str, suffix: str = "") -> dict:
    """Devuelve un participante con email único (rol + suffix)."""
    nombre = f"{area.title()}{suffix.title() if suffix else ''}"
    email_local = f"{area}{('-' + suffix) if suffix else ''}"
    return {"nombre": nombre, "email": f"{email_local}@x.es", "nivel": "cecopal"}


def build_payload(
    *,
    slug: str,
    org: int = 1,
    areas: tuple[str, ...] = ALL_AREAS,
    con_suplentes: bool = False,
) -> dict:
    """Payload del webhook /emergencias con `roles`."""
    roles = []
    for area in areas:
        rol_entry: dict = {"rol": area, "titular": _participante(area)}
        if con_suplentes:
            rol_entry["suplentes"] = [_participante(area, "sup")]
        roles.append(rol_entry)
    return {
        "organization_id": org,
        "slug": slug,
        "modo": "real",
        "roles": roles,
    }


async def alta(
    client: AsyncClient,
    slug: str,
    org: int = 1,
    *,
    areas: tuple[str, ...] = ALL_AREAS,
    con_suplentes: bool = False,
) -> FakeEmailSender:
    fake = FakeEmailSender()
    app.dependency_overrides[get_email_sender] = lambda: fake
    payload = build_payload(slug=slug, org=org, areas=areas, con_suplentes=con_suplentes)
    r = await client.post("/api/v1/emergencias", json=payload, headers=SECRET)
    assert r.status_code == 201, r.text
    return fake


async def login(
    client: AsyncClient,
    slug: str,
    fake: FakeEmailSender,
    area: str,
    *,
    force: bool = False,
    suffix: str = "",
) -> dict[str, str]:
    """Login con la credencial master del rol `area`.

    `suffix=""` → titular del rol. `suffix="sup"` → suplente (login backup con email).
    """
    email = f"{area}@x.es" if suffix == "" else f"{area}-{suffix}@x.es"
    token = fake.token_for(email)
    assert token, f"sin token para {email}"
    body: dict = {"token": token, "force": force}
    if suffix:
        body["email"] = email  # backup nominación
    r = await client.post(f"/api/v1/emergencias/{slug}/auth/login", json=body)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def clear_email_override() -> None:
    app.dependency_overrides.pop(get_email_sender, None)
