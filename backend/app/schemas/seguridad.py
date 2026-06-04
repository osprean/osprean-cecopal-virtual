"""Schemas del área de seguridad + transversales (recursos COMACON, logs)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GeoPoint(BaseModel):
    lat: float
    lng: float


# --- Perímetros ---
class PerimetroCreate(BaseModel):
    kind: str = Field(pattern="^(exclusion|evacuation|safety|buffer)$")
    label: str = Field(min_length=1, max_length=120)
    shape: str = Field(pattern="^(polygon|circle)$")
    points: list[GeoPoint] | None = None
    center_lat: float | None = None
    center_lng: float | None = None
    radius_m: float | None = None
    nivel: int | None = None
    color: str | None = Field(default=None, max_length=32)


class PerimetroRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    label: str
    shape: str
    points: list[Any] | None
    center_lat: float | None
    center_lng: float | None
    radius_m: float | None
    nivel: int | None
    color: str | None
    estado: str
    created_at: datetime


# --- Controles de acceso ---
class AccesoCreate(BaseModel):
    kind: str = Field(pattern="^(access|checkpoint)$")
    label: str = Field(min_length=1, max_length=120)
    lat: float
    lng: float
    units: int | None = None
    reason: str | None = Field(default=None, max_length=255)


class AccesoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    label: str
    lat: float
    lng: float
    estado: str
    units: int | None
    reason: str | None
    created_at: datetime


# --- Cortes viales ---
class CorteCreate(BaseModel):
    road: str = Field(min_length=1, max_length=160)
    km: str | None = Field(default=None, max_length=20)
    lat: float | None = None
    lng: float | None = None
    segment: dict[str, Any] | None = None
    reason: str | None = Field(default=None, max_length=255)


class CorteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    road: str
    km: str | None
    lat: float | None
    lng: float | None
    segment: dict[str, Any] | None
    reason: str | None
    estado: str
    created_at: datetime


# --- Incidencias ---
class IncidenciaCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    tipo: str = Field(max_length=24)
    severity: str = Field(pattern="^(critical|high|medium|low|info)$")
    lat: float | None = None
    lng: float | None = None
    description: str | None = Field(default=None, max_length=2000)


class IncidenciaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    title: str
    tipo: str
    severity: str
    estado: str
    lat: float | None
    lng: float | None
    description: str | None
    reported_at: datetime


# --- update de estado genérico ---
class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=14)


# --- transversales ---
class RecursoComaconRead(BaseModel):
    resource_id: int
    name: str
    status: str | None
    kind: str


class LogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    actor_usuario_id: int | None
    accion: str
    payload: dict[str, Any]
    at: datetime
