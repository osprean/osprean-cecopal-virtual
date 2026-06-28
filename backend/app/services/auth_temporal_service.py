"""Login con credencial temporal → JWT acotado a una emergencia.

Cambios P3:
- master/backup: al activar master, todas las backups del mismo (emergencia, rol)
  quedan `deshabilitada` y sus sesiones activas se cierran (`end_reason='master_in'`).
- Sesión única por credencial: si ya hay sesión activa, 409 `sesion_activa` salvo
  `force=True` que cierra la anterior con `end_reason='forced'`.
- El JWT lleva `jti` (UUID) que mapea a `cecovi_sesion`; `roles` (lista) viajan
  como claim (D4: roles compuestos).

`emergencia_id` sigue siendo el claim que cierra el 403 del resolver.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.credenciales import construir_token, generar_secreto, parsear_token
from app.core.email import EmailMessage, EmailSender
from app.core.exceptions import AppError, AuthError, ConflictError
from app.core.security import PasswordHasher, TokenService
from app.models.cecovi_credencial import CecoviCredencial
from app.models.cecovi_sesion import CecoviSesion
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.log_repository import LogRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository


@dataclass
class LoginResult:
    access_token: str
    emergencia_id: int
    roles: list[str]
    tipo: str
    sesion_id: int


class AuthTemporalService:
    def __init__(
        self,
        *,
        credenciales: CredencialRepository,
        usuarios: UsuarioTemporalRepository,
        logs: LogRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
        db: AsyncSession,
    ) -> None:
        self._credenciales = credenciales
        self._usuarios = usuarios
        self._logs = logs
        self._hasher = hasher
        self._tokens = tokens
        self._db = db

    async def login(
        self,
        *,
        emergencia_id: int,
        token: str,
        force: bool = False,
        email: str | None = None,
    ) -> LoginResult:
        cred_id, secreto = parsear_token(token)
        cred = await self._credenciales.get_in_emergencia(
            emergencia_id=emergencia_id, credencial_id=cred_id
        )
        if cred is None:
            raise AuthError("Credencial inválida", code="bad_credential")
        if cred.estado in ("revocada", "expirada", "deshabilitada"):
            raise AuthError("Credencial no válida", code="credential_revoked")
        if cred.expira_at is not None:
            expira = cred.expira_at
            if expira.tzinfo is None:
                expira = expira.replace(tzinfo=UTC)
            if datetime.now(UTC) > expira:
                raise AuthError("Credencial caducada", code="credential_expired")
        if not self._hasher.verify(secreto, cred.token_hash):
            raise AuthError("Credencial inválida", code="bad_credential")

        # Sesión activa existente para esta credencial.
        stmt = select(CecoviSesion).where(
            CecoviSesion.credencial_id == cred.id, CecoviSesion.ended_at.is_(None)
        )
        sesion_activa = (await self._db.execute(stmt)).scalar_one_or_none()
        if sesion_activa is not None:
            if not force:
                raise ConflictError(
                    "Ya hay una sesión activa para esta credencial",
                    code="sesion_activa",
                    extra={"sesion_id": sesion_activa.id},
                )
            sesion_activa.ended_at = datetime.now(UTC)
            sesion_activa.end_reason = "forced"

        # Si es MASTER: deshabilitar todas las backups del mismo (emergencia, rol).
        if cred.tipo == "master" and cred.roles:
            await self._deshabilitar_backups(cred)

        # Resolver usuario:
        # - master → ya tiene usuario_temporal_id asignado.
        # - backup → resolver por email (debe estar entre los suplentes
        #   pre-creados en el alta). Si el usuario aún no había hecho login, la
        #   credencial backup queda nominada (queda persistente para sesiones
        #   futuras).
        usuario_id = cred.usuario_temporal_id
        if usuario_id is None:
            if cred.tipo == "master":
                raise AppError("Credencial master sin usuario", code="master_sin_usuario")
            # backup: nominar por email.
            if not email:
                raise AppError(
                    "Credencial backup requiere email para nominar al usuario",
                    code="backup_email_required",
                )
            usuario = await self._usuarios.get_by_email(
                emergencia_id=emergencia_id, email=email
            )
            if usuario is None:
                raise AuthError("Email no autorizado", code="email_no_autorizado")
            usuario_id = usuario.id

        # Abrir sesión.
        jti = uuid.uuid4().hex
        sesion = CecoviSesion(
            credencial_id=cred.id, jti=jti, usuario_temporal_id=usuario_id
        )
        self._db.add(sesion)

        cred.estado = "activa"
        cred.usada_at = datetime.now(UTC)
        # backup: si era la primera vez, nominamos al usuario en la credencial.
        if cred.tipo == "backup" and cred.usuario_temporal_id is None and usuario_id is not None:
            cred.usuario_temporal_id = usuario_id

        roles = cred.roles_list()
        access = self._tokens.create_access_token(
            str(cred.id),  # sub = credencial_id (cambio P3)
            extra_claims={
                "emergencia_id": emergencia_id,
                "roles": roles,
                "tipo": cred.tipo,
                "jti": jti,
                "usuario_id": usuario_id,
            },
        )
        await self._logs.add(
            emergencia_id=emergencia_id,
            accion="login",
            actor_usuario_id=usuario_id,
            payload={
                "credencial_id": cred.id,
                "tipo": cred.tipo,
                "roles": roles,
                "forced": force,
            },
        )
        await self._db.flush()
        return LoginResult(
            access_token=access,
            emergencia_id=emergencia_id,
            roles=roles,
            tipo=cred.tipo,
            sesion_id=sesion.id,
        )

    async def _deshabilitar_backups(self, master: CecoviCredencial) -> None:
        """Cuando un master entra: marca todas las backups del mismo
        (emergencia, rol) como `deshabilitada` y cierra sus sesiones activas."""
        master_roles = set(master.roles_list())
        if not master_roles:
            return
        stmt = select(CecoviCredencial).where(
            CecoviCredencial.emergencia_id == master.emergencia_id,
            CecoviCredencial.tipo == "backup",
            CecoviCredencial.id != master.id,
            CecoviCredencial.estado.in_(("emitida", "activa")),
        )
        for backup in (await self._db.execute(stmt)).scalars():
            if not master_roles.intersection(backup.roles_list()):
                continue
            backup.estado = "deshabilitada"
            backup.deshabilitada_por_credencial_id = master.id
            # cerrar sesiones activas de esta backup
            stmt_s = select(CecoviSesion).where(
                CecoviSesion.credencial_id == backup.id, CecoviSesion.ended_at.is_(None)
            )
            for ses in (await self._db.execute(stmt_s)).scalars():
                ses.ended_at = datetime.now(UTC)
                ses.end_reason = "master_in"

    async def logout(self, *, sesion_id: int, jti: str) -> None:
        """Cierra la sesión. Si la credencial era master, reactiva sus backups."""
        stmt = select(CecoviSesion).where(
            CecoviSesion.id == sesion_id,
            CecoviSesion.jti == jti,
            CecoviSesion.ended_at.is_(None),
        )
        sesion = (await self._db.execute(stmt)).scalar_one_or_none()
        if sesion is None:
            return
        sesion.ended_at = datetime.now(UTC)
        sesion.end_reason = "logout"
        cred = await self._db.get(CecoviCredencial, sesion.credencial_id)
        if cred and cred.tipo == "master":
            await self._reactivar_backups(cred)
        await self._logs.add(
            emergencia_id=cred.emergencia_id if cred else 0,
            accion="logout",
            actor_usuario_id=sesion.usuario_temporal_id,
            payload={"credencial_id": cred.id if cred else None, "sesion_id": sesion_id},
        )

    async def _reactivar_backups(self, master: CecoviCredencial) -> None:
        stmt = select(CecoviCredencial).where(
            CecoviCredencial.emergencia_id == master.emergencia_id,
            CecoviCredencial.deshabilitada_por_credencial_id == master.id,
        )
        for backup in (await self._db.execute(stmt)).scalars():
            backup.estado = "emitida"
            backup.deshabilitada_por_credencial_id = None

    async def transferir(
        self,
        *,
        credencial_origen_id: int,
        nuevo_nombre: str,
        nuevo_email: str,
        nuevo_telefono: str | None,
        motivo: str,
        email_sender: EmailSender,
        emergencia_slug: str,
    ) -> dict[str, Any]:
        """Transfiere el rol (P10).

        Pasos: invalidar credencial actual y sus sesiones; crear/recuperar
        `cecovi_usuario_temporal` por email; crear credencial nueva del mismo
        tipo/roles; enviar token al nuevo destinatario; auditar.
        """
        cred_origen = await self._db.get(CecoviCredencial, credencial_origen_id)
        if cred_origen is None:
            raise AppError("Credencial origen no existe", code="credencial_origen_no_existe")
        # Cerrar sesiones activas de la credencial origen.
        stmt_s = select(CecoviSesion).where(
            CecoviSesion.credencial_id == credencial_origen_id,
            CecoviSesion.ended_at.is_(None),
        )
        for ses in (await self._db.execute(stmt_s)).scalars():
            ses.ended_at = datetime.now(UTC)
            ses.end_reason = "transferida"
        cred_origen.estado = "revocada"

        # Resolver / crear usuario nuevo por email.
        usuario_nuevo = await self._usuarios.get_by_email(
            emergencia_id=cred_origen.emergencia_id, email=nuevo_email
        )
        if usuario_nuevo is None:
            usuario_nuevo = await self._usuarios.create(
                emergencia_id=cred_origen.emergencia_id,
                nombre=nuevo_nombre,
                email=nuevo_email,
                telefono=nuevo_telefono,
                nivel="cecopal",
                roles_confirmados=True,
            )

        settings = get_settings()
        expira_at = datetime.now(UTC) + timedelta(hours=settings.CREDENCIAL_EXPIRE_HOURS)
        secreto = generar_secreto()
        cred_nueva = await self._credenciales.create(
            emergencia_id=cred_origen.emergencia_id,
            usuario_temporal_id=usuario_nuevo.id,
            token_hash=self._hasher.hash(secreto),
            expira_at=expira_at,
            tipo=cred_origen.tipo,
            roles=cred_origen.roles,
        )
        token = construir_token(cred_nueva.id, secreto)
        body = (
            f"Has recibido por transferencia el rol '{cred_nueva.roles}' "
            f"en la emergencia '{emergencia_slug}'.\n"
            f"Motivo: {motivo}\n"
            f"Tu credencial temporal: {token}\n"
            "No la compartas."
        )
        email_sender.send(
            EmailMessage(
                to=nuevo_email,
                subject=f"Transferencia de rol — {emergencia_slug}",
                body=body,
            )
        )

        await self._logs.add(
            emergencia_id=cred_origen.emergencia_id,
            accion="rol_transferido",
            actor_usuario_id=cred_origen.usuario_temporal_id,
            payload={
                "credencial_origen_id": cred_origen.id,
                "credencial_nueva_id": cred_nueva.id,
                "destinatario_email": nuevo_email,
                "motivo": motivo,
                "roles": cred_origen.roles,
                "tipo": cred_origen.tipo,
            },
        )
        await self._db.flush()
        return {
            "credencial_origen_id": cred_origen.id,
            "credencial_nueva_id": cred_nueva.id,
            "nuevo_usuario_id": usuario_nuevo.id,
        }
