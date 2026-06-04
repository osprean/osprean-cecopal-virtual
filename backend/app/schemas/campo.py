"""Schemas del área campo."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TareaCreate(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    priority: str = Field(default="medium", pattern="^(critical|high|medium|low)$")
    assigned_to: str | None = Field(default=None, max_length=60)
    lat: float | None = None
    lng: float | None = None


class TareaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    code: str
    title: str
    description: str | None
    priority: str
    estado: str
    assigned_to: str | None
    lat: float | None
    lng: float | None


class ReporteCreate(BaseModel):
    kind: str = Field(pattern="^(incident|voice|image|checkpoint|support)$")
    title: str = Field(min_length=1, max_length=160)
    body: str | None = Field(default=None, max_length=4000)
    lat: float | None = None
    lng: float | None = None
    transcribed: bool = False


class ReporteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    title: str
    body: str | None
    lat: float | None
    lng: float | None
    transcribed: bool
    created_by: str | None
    created_at: datetime


class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=14)
