"""Flujo completo de auth: register → login → /me → refresh."""

from __future__ import annotations

from httpx import AsyncClient


async def test_register_login_me_refresh(
    client: AsyncClient,
    user_payload: dict[str, str],
) -> None:
    r = await client.post("/api/v1/auth/register", json=user_payload)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["email"] == user_payload["email"]
    assert created["is_active"] is True
    assert "hashed_password" not in created

    r = await client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["token_type"] == "bearer"
    access = tokens["access_token"]
    refresh = tokens["refresh_token"]

    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["email"] == user_payload["email"]

    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    new_tokens = r.json()
    assert new_tokens["access_token"]
    assert new_tokens["refresh_token"]


async def test_register_duplicate_rejected(
    client: AsyncClient, user_payload: dict[str, str]
) -> None:
    r = await client.post("/api/v1/auth/register", json=user_payload)
    assert r.status_code == 201
    r = await client.post("/api/v1/auth/register", json=user_payload)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_login_bad_credentials(client: AsyncClient, user_payload: dict[str, str]) -> None:
    await client.post("/api/v1/auth/register", json=user_payload)
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": user_payload["email"], "password": "wrong-password-1"},
    )
    assert r.status_code == 401


async def test_me_without_token(client: AsyncClient) -> None:
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


async def test_users_me_alias(client: AsyncClient, user_payload: dict[str, str]) -> None:
    await client.post("/api/v1/auth/register", json=user_payload)
    r = await client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    access = r.json()["access_token"]
    r = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["email"] == user_payload["email"]


async def test_refresh_with_access_token_rejected(
    client: AsyncClient, user_payload: dict[str, str]
) -> None:
    await client.post("/api/v1/auth/register", json=user_payload)
    r = await client.post(
        "/api/v1/auth/login",
        data={
            "username": user_payload["email"],
            "password": user_payload["password"],
        },
    )
    access = r.json()["access_token"]
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": access})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "token_invalid"


async def test_me_with_garbage_token(client: AsyncClient) -> None:
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
