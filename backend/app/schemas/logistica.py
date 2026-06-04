"""Schemas del área logística."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SuministroCreate(BaseModel):
    category: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=120)
    unit: str = Field(default="ud", max_length=20)
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=0, ge=0)
    location: str | None = Field(default=None, max_length=160)


class SuministroRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    category: str
    name: str
    unit: str
    stock: int
    min_stock: int
    location: str | None


class StockAjuste(BaseModel):
    delta: int


class SolicitudCreate(BaseModel):
    requested_by: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=20)
    item_name: str = Field(min_length=1, max_length=160)
    quantity: int = Field(default=1, ge=1)
    unit: str | None = Field(default=None, max_length=20)
    priority: str = Field(default="medium", pattern="^(critical|high|medium|low)$")
    destination: str | None = Field(default=None, max_length=160)


class SolicitudRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    requested_by: str
    category: str
    item_name: str
    quantity: int
    unit: str | None
    priority: str
    estado: str
    destination: str | None
    requested_at: datetime
    decided_at: datetime | None


class ServicioCreate(BaseModel):
    kind: str = Field(min_length=1, max_length=16)
    area: str = Field(min_length=1, max_length=160)
    affected_population: int = Field(default=0, ge=0)
    provider: str | None = Field(default=None, max_length=120)


class ServicioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emergencia_id: int
    kind: str
    area: str
    estado: str
    affected_population: int
    provider: str | None


class EstadoUpdate(BaseModel):
    estado: str = Field(min_length=1, max_length=12)
