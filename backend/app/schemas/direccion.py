"""Schemas del área de dirección."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GrupoCreate(BaseModel):
    tipo: str = Field(min_length=1, max_length=24)
    leader: str | None = Field(default=None, max_length=120)
    channel: str | None = Field(default=None, max_length=60)
    members_total: int = 0
    members_active: int = 0


class GrupoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    tipo: str
    estado: str
    members_total: int
    members_active: int
    leader: str | None
    channel: str | None


class SolicitudMediosCreate(BaseModel):
    requested_by: str = Field(min_length=1, max_length=120)
    resource_type: str = Field(min_length=1, max_length=40)
    quantity: int = Field(default=1, ge=1)
    reason: str | None = Field(default=None, max_length=500)
    priority: str = Field(default="medium", pattern="^(critical|high|medium|low)$")


class SolicitudMediosRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    requested_by: str
    resource_type: str
    quantity: int
    reason: str | None
    priority: str
    estado: str
    requested_at: datetime
    decided_at: datetime | None


class ComunicadoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    audience: str = Field(default="internal", pattern="^(internal|press|population|authorities)$")


class ComunicadoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    title: str
    body: str
    audience: str
    estado: str
    created_by: str | None
    created_at: datetime


class AlbergueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    lat: float | None = None
    lng: float | None = None
    capacity: int = Field(default=0, ge=0)


class AlbergueRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    name: str
    lat: float | None
    lng: float | None
    capacity: int
    occupancy: int
    estado: str


class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=20)


class OcupacionUpdate(BaseModel):
    occupancy: int = Field(ge=0)
