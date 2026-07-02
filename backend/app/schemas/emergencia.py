"""Schemas de la entidad emergencia y del flujo de alta/acceso (F2 + P3/P4).

Cambios P3/P4:
- El webhook recibe `roles` (lista). Cada rol trae `titular` y `suplentes`.
- Por cada rol → 1 credencial master (titular) + 1 credencial backup (compartida
  por los suplentes; quien la use primero queda nominado).
- `tipo` se devuelve en el login junto con la lista de `roles`.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmergenciaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    organization_id: int
    estado: str
    modo: str
    nivel: str
    created_at: datetime


class ParticipanteIn(BaseModel):
    """Una persona física que recibe una credencial."""

    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=32)
    nivel: str = Field(default="cecopal", pattern="^(cecopal|pma)$")


class RolIn(BaseModel):
    """Un rol del CECOPAL con su titular (master) y suplentes (backup)."""

    rol: str = Field(min_length=1, max_length=40)
    titular: ParticipanteIn
    suplentes: list[ParticipanteIn] = Field(default_factory=list)


class CrearEmergenciaIn(BaseModel):
    """Cuerpo del webhook de confirmación de emergencia (COMACON → CECOVI)."""

    organization_id: int
    comacon_emergency_id: int | None = None
    slug: str = Field(min_length=1, max_length=64, pattern="^[a-z0-9][a-z0-9-]*$")
    modo: str = Field(pattern="^(real|simulacro)$")
    roles: list[RolIn] = Field(min_length=1)
    # Snapshot PNG del organigrama del CECOPAL capturado en COMACON (data URL o
    # base64 pelado). Opcional: si no llega, la emergencia se crea sin imagen.
    organigrama_png_b64: str | None = None


class EmergenciaCreada(BaseModel):
    id: int
    slug: str
    modo: str
    n_master: int
    n_backup: int
    direccion_usuario_id: int | None


class LoginIn(BaseModel):
    """Canje de credencial temporal. El token tiene formato `<id>.<secreto>`.

    Para credenciales BACKUP compartidas, el login debe incluir `email` para
    nominar a quién la está usando (se busca entre los suplentes pre-creados al
    alta).
    """

    token: str = Field(min_length=3)
    force: bool = False
    email: EmailStr | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    emergencia_id: int
    roles: list[str]
    tipo: str  # master|backup
    sesion_id: int


class RolSeleccionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rol: str
    activo: bool


class MeOut(BaseModel):
    usuario_id: int | None
    emergencia_id: int
    nombre: str | None
    telefono: str | None
    nivel: str | None
    solo_lectura: bool
    roles: list[str]
    tipo: str  # master|backup


class CatalogoRolesOut(BaseModel):
    seleccionables: list[str]


class SeleccionRolesIn(BaseModel):
    """DEPRECADO P3: los roles vienen de la credencial, no se seleccionan."""

    roles: list[str] = Field(min_length=1)
