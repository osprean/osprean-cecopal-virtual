"""Schemas de la entidad emergencia y del flujo de alta/acceso (F2)."""

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
    """Una entrada del organigrama enviada por COMACON en el webhook.

    COMACON deriva el roster de su organigrama (ver supuesto en el servicio) y
    marca exactamente UN participante como jefe (`es_jefe`).
    """

    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=32)
    nivel: str = Field(default="cecopal", pattern="^(cecopal|pma)$")
    # es_jefe (término CECOVI) se puebla desde es_alcalde del nodo CECOPAL en COMACON.
    es_jefe: bool = False


class CrearEmergenciaIn(BaseModel):
    """Cuerpo del webhook de confirmación de emergencia (COMACON → CECOVI)."""

    organization_id: int
    comacon_emergency_id: int | None = None
    slug: str = Field(min_length=1, max_length=64, pattern="^[a-z0-9][a-z0-9-]*$")
    modo: str = Field(pattern="^(real|simulacro)$")
    participantes: list[ParticipanteIn] = Field(min_length=1)


class EmergenciaCreada(BaseModel):
    id: int
    slug: str
    modo: str
    n_credenciales: int
    jefe_usuario_id: int


class LoginIn(BaseModel):
    """Canje de credencial temporal. El token tiene formato `<id>.<secreto>`."""

    token: str = Field(min_length=3)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    emergencia_id: int
    nivel: str


class RolSeleccionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rol: str
    activo: bool


class MeOut(BaseModel):
    usuario_id: int
    emergencia_id: int
    nombre: str
    telefono: str | None
    nivel: str
    solo_lectura: bool
    roles_confirmados: bool
    roles: list[str]


class CatalogoRolesOut(BaseModel):
    seleccionables: list[str]


class SeleccionRolesIn(BaseModel):
    roles: list[str] = Field(min_length=1)
