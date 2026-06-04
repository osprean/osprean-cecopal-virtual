"""Enrutado /{idEmergencia} + alta de emergencia, login temporal y roles (F2).

- Alta: la dispara un operador de COMACON vía webhook (POST /emergencias con
  cabecera X-Webhook-Secret), no por inserción directa en DB.
- Login: canjea credencial temporal → JWT con claim emergencia_id (cierra el 403).
- Roles: catálogo + selección inmutable en el primer acceso (I4).
La transferencia (F4), overlay de recursos (F5) y PDF/cierre (F6) NO van aquí.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, status

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
    SeleccionRolesIn,
    TokenOut,
)
from app.services.auth_temporal_service import AuthTemporalService
from app.services.emergencia_service import EmergenciaService, EmergenciaServiceDeps
from app.services.roles_service import RolesService
from app.tenancy import EmergenciaCtx, Principal, ResolvedEmergencia

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
        )
    )
    em_id, slug, n_cred, jefe_id = await svc.crear(
        organization_id=payload.organization_id,
        comacon_emergency_id=payload.comacon_emergency_id,
        slug=payload.slug,
        modo=payload.modo,
        participantes=payload.participantes,
    )
    await db.commit()
    return EmergenciaCreada(
        id=em_id, slug=slug, modo=payload.modo, n_credenciales=n_cred, jefe_usuario_id=jefe_id
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
    emergencia: ResolvedEmergencia,  # 404 si el slug no existe; NO exige sesión previa
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
    )
    result = await svc.login(emergencia_id=emergencia.id, token=payload.token)
    await db.commit()
    return TokenOut(
        access_token=result.access_token,
        emergencia_id=result.emergencia_id,
        nivel=result.nivel,
    )


@router.get(
    "/{id_emergencia}/auth/me",
    response_model=MeOut,
    summary="Principal autenticado y sus roles",
)
async def me(principal: Principal, db: DbSession) -> MeOut:
    roles = await RolSeleccionRepository(db).list_for_usuario(
        emergencia_id=principal.emergencia_id, usuario_temporal_id=principal.id
    )
    return MeOut(
        usuario_id=principal.id,
        emergencia_id=principal.emergencia_id,
        nombre=principal.nombre,
        nivel=principal.nivel,
        solo_lectura=principal.solo_lectura,
        roles_confirmados=principal.roles_confirmados,
        roles=[r.rol for r in roles if r.activo],
    )


@router.get(
    "/{id_emergencia}/roles/catalogo",
    response_model=CatalogoRolesOut,
    summary="Roles seleccionables (el jefe se designa, no se elige)",
)
async def catalogo_roles(emergencia: EmergenciaCtx) -> CatalogoRolesOut:
    return CatalogoRolesOut(seleccionables=RolesService.catalogo())


@router.post(
    "/{id_emergencia}/roles/seleccion",
    response_model=MeOut,
    summary="Elegir rol(es) en el primer acceso (inmutable tras confirmar)",
)
async def seleccionar_roles(
    payload: SeleccionRolesIn,
    principal: Principal,
    db: DbSession,
) -> MeOut:
    svc = RolesService(roles=RolSeleccionRepository(db), logs=LogRepository(db))
    await svc.seleccionar(usuario=principal, roles=payload.roles)
    await db.commit()
    roles = await RolSeleccionRepository(db).list_for_usuario(
        emergencia_id=principal.emergencia_id, usuario_temporal_id=principal.id
    )
    return MeOut(
        usuario_id=principal.id,
        emergencia_id=principal.emergencia_id,
        nombre=principal.nombre,
        nivel=principal.nivel,
        solo_lectura=principal.solo_lectura,
        roles_confirmados=principal.roles_confirmados,
        roles=[r.rol for r in roles if r.activo],
    )
