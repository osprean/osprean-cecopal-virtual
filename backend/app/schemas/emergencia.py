"""Schemas de la entidad emergencia."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EmergenciaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    organization_id: int
    estado: str
    modo: str
    nivel: str
    created_at: datetime
