"""Unit tests para security primitives."""

from __future__ import annotations

import time

import pytest

from app.core.exceptions import AuthError
from app.core.security import BcryptPasswordHasher, JwtTokenService


def test_password_hash_and_verify_roundtrip() -> None:
    hasher = BcryptPasswordHasher()
    h = hasher.hash("hunter2-extra-long")
    assert h != "hunter2-extra-long"
    assert hasher.verify("hunter2-extra-long", h) is True
    assert hasher.verify("wrong", h) is False


def test_jwt_access_token_roundtrip() -> None:
    svc = JwtTokenService(secret="testsecret", algorithm="HS256", access_minutes=5, refresh_days=1)
    token = svc.create_access_token("42")
    assert svc.decode(token, expected_type="access") == "42"


def test_jwt_refresh_token_roundtrip() -> None:
    svc = JwtTokenService(secret="testsecret", algorithm="HS256", access_minutes=5, refresh_days=1)
    token = svc.create_refresh_token("99")
    assert svc.decode(token, expected_type="refresh") == "99"


def test_jwt_wrong_type_rejected() -> None:
    svc = JwtTokenService(secret="testsecret", algorithm="HS256", access_minutes=5, refresh_days=1)
    access = svc.create_access_token("1")
    with pytest.raises(AuthError):
        svc.decode(access, expected_type="refresh")


def test_jwt_tampered_token_rejected() -> None:
    svc = JwtTokenService(secret="testsecret", algorithm="HS256", access_minutes=5, refresh_days=1)
    token = svc.create_access_token("1")
    bad = token[:-2] + ("AA" if token[-2:] != "AA" else "BB")
    with pytest.raises(AuthError):
        svc.decode(bad, expected_type="access")


def test_jwt_expired_token_rejected() -> None:
    svc = JwtTokenService(
        secret="testsecret",
        algorithm="HS256",
        access_minutes=0,
        refresh_days=0,
    )
    token = svc.create_access_token("1")
    time.sleep(1)
    with pytest.raises(AuthError):
        svc.decode(token, expected_type="access")
