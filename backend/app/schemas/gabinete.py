"""Schemas del área gabinete."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CanalCreate(BaseModel):
    kind: str = Field(min_length=1, max_length=24)
    audience_reach: int | None = Field(default=None, ge=0)


class CanalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    estado: str
    audience_reach: int | None


class PublicacionCreate(BaseModel):
    comunicado_id: int | None = None
    canal_id: int | None = None
    reach: int | None = Field(default=None, ge=0)


class PublicacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    comunicado_id: int | None
    canal_id: int | None
    estado: str
    reach: int | None
    created_at: datetime


class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=16)
