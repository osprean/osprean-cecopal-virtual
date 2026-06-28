"""Enrutado /{idEmergencia} + alta de emergencia y auth temporal (F2 + P3).

Cambios P3:
- Login devuelve `roles` (lista) + `tipo` (master|backup) + `sesion_id`.
- Login acepta `force=true` para cerrar la sesión previa de la misma credencial.
- Nuevo endpoint POST /auth/logout que cierra la sesión y reactiva backups si el
  saliente era master.
- `/auth/me` lee del JWT (no de cecovi_rol_seleccion).
- `/roles/seleccion` queda como noop deprecado (los roles vienen de la credencial).

La transferencia (P10), overlay (F5) y PDF/cierre (P11) NO van aquí.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, status
from pydantic import BaseModel, EmailStr, Field

from app.config import get_settings
from app.core.exceptions import AuthError
from app.deps import DbSession, EmailSenderDep, Hasher, TokenSvc
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.emergencia_repository import EmergenciaRepository
from app.repositories.log_repository import LogRepository
from app.repositories.rol_seleccion_repository import RolSeleccionRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository
from app.schemas.emergencia import (
    CatalogoRolesOut,
    CrearEmergenciaIn,
    EmergenciaCreada,
    EmergenciaRead,
    LoginIn,
    MeOut,
    TokenOut,
)
from app.services.auth_temporal_service import AuthTemporalService
from app.services.emergencia_service import EmergenciaService, EmergenciaServiceDeps
from app.services.roles_service import RolesService
from app.tenancy import EmergenciaCtx, ResolvedEmergencia, SessionDep

router = APIRouter(prefix="/emergencias", tags=["emergencias"])


def _require_webhook_secret(secret: str | None) -> None:
    expected = get_settings().COMACON_WEBHOOK_SECRET
    if not secret or secret != expected:
        raise AuthError("Webhook no autorizado", code="webhook_unauthorized")


@router.post(
    "",
    response_model=EmergenciaCreada,
    status_code=status.HTTP_201_CREATED,
    summary="Confirmar/crear emergencia (webhook COMACON)",
)
async def crear_emergencia(
    payload: CrearEmergenciaIn,
    db: DbSession,
    hasher: Hasher,
    email: EmailSenderDep,
    x_webhook_secret: Annotated[str | None, Header()] = None,
) -> EmergenciaCreada:
    _require_webhook_secret(x_webhook_secret)
    svc = EmergenciaService(
        EmergenciaServiceDeps(
            emergencias=EmergenciaRepository(db),
            usuarios=UsuarioTemporalRepository(db),
            credenciales=CredencialRepository(db),
            roles=RolSeleccionRepository(db),
            logs=LogRepository(db),
            hasher=hasher,
            email=email,
            db=db,
        )
    )
    em_id, slug, n_master, n_backup, direccion_usuario_id = await svc.crear(
        organization_id=payload.organization_id,
        comacon_emergency_id=payload.comacon_emergency_id,
        slug=payload.slug,
        modo=payload.modo,
        roles=payload.roles,
    )
    await db.commit()
    return EmergenciaCreada(
        id=em_id,
        slug=slug,
        modo=payload.modo,
        n_master=n_master,
        n_backup=n_backup,
        direccion_usuario_id=direccion_usuario_id,
    )


@router.get(
    "/{id_emergencia}",
    response_model=EmergenciaRead,
    summary="Resolver una emergencia por su slug de ruta",
)
async def get_emergencia(emergencia: EmergenciaCtx) -> EmergenciaRead:
    return EmergenciaRead.model_validate(emergencia)


@router.post(
    "/{id_emergencia}/auth/login",
    response_model=TokenOut,
    summary="Login con credencial temporal",
)
async def login(
    payload: LoginIn,
    emergencia: ResolvedEmergencia,
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
) -> TokenOut:
    svc = AuthTemporalService(
        credenciales=CredencialRepository(db),
        usuarios=UsuarioTemporalRepository(db),
        logs=LogRepository(db),
        hasher=hasher,
        tokens=tokens,
        db=db,
    )
    result = await svc.login(
        emergencia_id=emergencia.id,
        token=payload.token,
        force=payload.force,
        email=payload.email,
    )
    await db.commit()
    return TokenOut(
        access_token=result.access_token,
        emergencia_id=result.emergencia_id,
        roles=result.roles,
        tipo=result.tipo,
        sesion_id=result.sesion_id,
    )


@router.post(
    "/{id_emergencia}/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar la sesión actual (y reactivar backups si era master)",
)
async def logout(
    emergencia: EmergenciaCtx,
    session: SessionDep,
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
) -> None:
    svc = AuthTemporalService(
        credenciales=CredencialRepository(db),
        usuarios=UsuarioTemporalRepository(db),
        logs=LogRepository(db),
        hasher=hasher,
        tokens=tokens,
        db=db,
    )
    # session.sesion_id no está en SessionCtx; obtenemos por jti.
    from sqlalchemy import select

    from app.models.cecovi_sesion import CecoviSesion

    stmt = select(CecoviSesion).where(CecoviSesion.jti == session.jti)
    sesion = (await db.execute(stmt)).scalar_one_or_none()
    if sesion is None:
        await db.commit()
        return None
    await svc.logout(sesion_id=sesion.id, jti=session.jti)
    await db.commit()
    return None


class TransferirIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=32)
    motivo: str = Field(min_length=1, max_length=500)


class TransferirOut(BaseModel):
    credencial_origen_id: int
    credencial_nueva_id: int
    nuevo_usuario_id: int


@router.post(
    "/{id_emergencia}/auth/transferir",
    response_model=TransferirOut,
    status_code=status.HTTP_201_CREATED,
    summary="Transferir el rol actual a otra persona (P10)",
)
async def transferir(
    payload: TransferirIn,
    emergencia: EmergenciaCtx,
    session: SessionDep,
    db: DbSession,
    hasher: Hasher,
    tokens: TokenSvc,
    email: EmailSenderDep,
) -> TransferirOut:
    svc = AuthTemporalService(
        credenciales=CredencialRepository(db),
        usuarios=UsuarioTemporalRepository(db),
        logs=LogRepository(db),
        hasher=hasher,
        tokens=tokens,
        db=db,
    )
    result = await svc.transferir(
        credencial_origen_id=session.credencial_id,
        nuevo_nombre=payload.nombre,
        nuevo_email=payload.email,
        nuevo_telefono=payload.telefono,
        motivo=payload.motivo,
        email_sender=email,
        emergencia_slug=emergencia.slug,
    )
    await db.commit()
    return TransferirOut(**result)


@router.get(
    "/{id_emergencia}/auth/me",
    response_model=MeOut,
    summary="Sesión actual: roles del JWT + datos del usuario nominado (si lo hay)",
)
async def me(session: SessionDep, db: DbSession) -> MeOut:
    """Lee los roles del JWT y, si hay usuario_id, completa los datos del usuario temporal."""
    usuario_id = session.usuario_id
    nombre: str | None = None
    telefono: str | None = None
    nivel: str | None = None
    solo_lectura = False
    if usuario_id is not None:
        usuario = await UsuarioTemporalRepository(db).get_in_emergencia(
            emergencia_id=session.emergencia_id, usuario_id=usuario_id
        )
        if usuario is not None:
            nombre = usuario.nombre
            telefono = usuario.telefono
            nivel = usuario.nivel
            solo_lectura = usuario.solo_lectura
    return MeOut(
        usuario_id=usuario_id,
        emergencia_id=session.emergencia_id,
        nombre=nombre,
        telefono=telefono,
        nivel=nivel,
        solo_lectura=solo_lectura,
        roles=session.roles,
        tipo=session.tipo,
    )


@router.get(
    "/{id_emergencia}/roles/catalogo",
    response_model=CatalogoRolesOut,
    summary="Catálogo de roles disponibles (legacy info)",
)
async def catalogo_roles(emergencia: EmergenciaCtx) -> CatalogoRolesOut:
    return CatalogoRolesOut(seleccionables=RolesService.catalogo())
