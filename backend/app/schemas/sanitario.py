"""Schemas del área sanitario."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VictimaCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    triage: str = Field(default="unset", pattern="^(red|yellow|green|black|unset)$")
    lat: float | None = None
    lng: float | None = None
    notes: str | None = Field(default=None, max_length=1000)


class VictimaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    code: str
    triage: str
    estado: str
    lat: float | None
    lng: float | None
    notes: str | None
    registered_at: datetime


class TriajeUpdate(BaseModel):
    triage: str = Field(pattern="^(red|yellow|green|black|unset)$")


class ZonaCreate(BaseModel):
    kind: str = Field(min_length=1, max_length=16)
    label: str = Field(min_length=1, max_length=120)
    lat: float | None = None
    lng: float | None = None
    capacity: int = Field(default=0, ge=0)


class ZonaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    label: str
    lat: float | None
    lng: float | None
    capacity: int
    current: int
    estado: str


class AlertaCreate(BaseModel):
    source: str = Field(min_length=1, max_length=120)
    message: str = Field(min_length=1, max_length=1000)
    severity: str = Field(default="medium", pattern="^(critical|high|medium|low)$")


class AlertaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    source: str
    message: str
    severity: str
    acknowledged: bool
    created_at: datetime


class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=16)
