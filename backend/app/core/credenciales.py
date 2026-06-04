"""Tokens de credencial temporal.

Formato `<credencial_id>.<secreto>`: el id permite localizar la fila (no es
secreto) y el secreto se verifica contra su hash (bcrypt). En DB se guarda SOLO
el hash del secreto; el token en claro viaja únicamente en el email.
"""

from __future__ import annotations

import secrets

from app.core.exceptions import AuthError

_SECRET_BYTES = 32


def generar_secreto() -> str:
    return secrets.token_urlsafe(_SECRET_BYTES)


def construir_token(credencial_id: int, secreto: str) -> str:
    return f"{credencial_id}.{secreto}"


def parsear_token(token: str) -> tuple[int, str]:
    """Devuelve (credencial_id, secreto) o lanza AuthError si el formato es inválido."""
    cred_id, sep, secreto = token.partition(".")
    if not sep or not secreto:
        raise AuthError("Credencial inválida", code="bad_credential")
    try:
        return int(cred_id), secreto
    except ValueError as exc:
        raise AuthError("Credencial inválida", code="bad_credential") from exc
