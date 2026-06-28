"""Schemas tareas operativas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TareaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    emergencia_id: int
    rol: str
    codigo: str | None
    titulo: str
    descripcion: str | None
    orden: int
    estado: str
    accepted_by_id: int | None
    accepted_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class TareaCreate(BaseModel):
    rol: str
    titulo: str
    descripcion: str | None = None
    codigo: str | None = None
    orden: int = 0
