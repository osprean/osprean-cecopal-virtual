"""CRUD básico + ownership de items."""

from __future__ import annotations

from httpx import AsyncClient


async def _register_and_login(client: AsyncClient, email: str, password: str) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": None},
    )
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )
    return str(r.json()["access_token"])


async def test_create_and_list_item(client: AsyncClient) -> None:
    token = await _register_and_login(client, "owner@example.com", "password-12345")
    headers = {"Authorization": f"Bearer {token}"}

    r = await client.post(
        "/api/v1/items",
        json={"name": "First", "description": "hello"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["name"] == "First"
    assert item["owner_id"] > 0

    r = await client.get("/api/v1/items", headers=headers)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["id"] == item["id"]

    r = await client.get(f"/api/v1/items/{item['id']}", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == item["id"]


async def test_item_ownership_enforced(client: AsyncClient) -> None:
    alice = await _register_and_login(client, "alice@example.com", "password-12345")
    bob = await _register_and_login(client, "bob@example.com", "password-12345")

    r = await client.post(
        "/api/v1/items",
        json={"name": "Alice's", "description": None},
        headers={"Authorization": f"Bearer {alice}"},
    )
    assert r.status_code == 201
    item_id = r.json()["id"]

    r = await client.get(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {bob}"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_owner"

    r = await client.get("/api/v1/items", headers={"Authorization": f"Bearer {bob}"})
    assert r.json() == []


async def test_items_require_auth(client: AsyncClient) -> None:
    r = await client.get("/api/v1/items")
    assert r.status_code == 401


async def test_get_item_not_found(client: AsyncClient) -> None:
    token = await _register_and_login(client, "x@example.com", "password-12345")
    r = await client.get("/api/v1/items/9999", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "item_not_found"
