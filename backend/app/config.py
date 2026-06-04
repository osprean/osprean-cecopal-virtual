"""Configuración cargada desde entorno y .env via pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
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

    JWT_SECRET_KEY: str = Field(
        default="dev-insecure-change-me",
        description="Secret para firmar JWTs. OBLIGATORIO sobrescribir en prod.",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    FRONTEND_DIST_PATH: str = "/app/frontend/dist"

    CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=list)

    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
