"""Configuración cargada desde entorno y .env via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import quote_plus

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Env = Literal["development", "staging", "production", "test"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENV: Env = "development"

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://app:app@localhost:5432/app",
        description="DSN async SQLAlchemy. En tests se sobrescribe.",
    )

    # --- Conexión por partes (cluster) ----------------------------------------
    # En k8s el password viene de un Secret (ESO desde Azure KV) y NO debe ir en
    # el ConfigMap. Si POSTGRES_PASSWORD está presente, DATABASE_URL se construye
    # a partir de estas piezas (ver model_validator). Comparte el MISMO Postgres
    # que COMACON (db `comacon`) para que resuelvan las FK a organization/etc.
    DB_USER: str = ""
    DB_HOST: str = ""  # host:puerto, p.ej. pg-comacon-staging-rw.data.svc.cluster.local:5432
    DB_NAME: str = ""
    POSTGRES_PASSWORD: str = ""

    JWT_SECRET_KEY: str = Field(
        default="dev-insecure-change-me",
        description="Secret para firmar JWTs. OBLIGATORIO sobrescribir en prod.",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- CECOVI ---------------------------------------------------------------
    # Secreto compartido para el webhook de confirmación de emergencia desde
    # COMACON (cabecera X-Webhook-Secret). OBLIGATORIO sobrescribir en prod.
    COMACON_WEBHOOK_SECRET: str = Field(default="dev-webhook-secret-change-me")
    # Vida de una credencial temporal (horas) desde su emisión.
    CREDENCIAL_EXPIRE_HOURS: int = 720
    # En modo simulacro, los emails se enrutan aquí en vez de a los contactos
    # reales. Si está vacío, en simulacro NO se envía a destinatarios reales.
    SIMULACRO_EMAIL_SINK: str = ""

    FRONTEND_DIST_PATH: str = "/app/frontend/dist"
    # URL pública del frontend (para enlaces en emails). En dev típicamente
    # http://localhost:5174; en prod, https://cecovi.osprean.net.
    PUBLIC_FRONTEND_BASE: str = "http://localhost:5174"

    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=list)

    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @model_validator(mode="after")
    def _build_database_url(self) -> Settings:
        """En cluster, reconstruye DATABASE_URL desde las piezas + el password
        del Secret. Solo si POSTGRES_PASSWORD está presente; si no, se respeta
        DATABASE_URL tal cual (dev/tests)."""
        if self.POSTGRES_PASSWORD and self.DB_HOST and self.DB_USER and self.DB_NAME:
            pw = quote_plus(self.POSTGRES_PASSWORD)
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.DB_USER}:{pw}@{self.DB_HOST}/{self.DB_NAME}"
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
