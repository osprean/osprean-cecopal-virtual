"""Alta de emergencia disparada por el webhook de COMACON.

DERIVACIÓN DE N (supuesto a confirmar): no existe en COMACON una tabla
`organigram` canónica. Se asume que COMACON deriva el roster del organigrama de
la organización (combinando miembros de `organization`, `escalation_list` y
`phone_directory_entries`) y lo envía en el webhook. Por tanto N = número de
participantes recibidos; CECOVI no infiere el organigrama (decoplado y auditable).

DESIGNACIÓN DEL JEFE (mitad "nunca cero" de I1): el operador de COMACON marca
EXACTAMENTE un participante como jefe (`es_jefe`). CECOVI lo valida (rechaza 0 o
>1) y crea su `cecovi_rol_seleccion` (rol='jefe', activo) EN EL MISMO ALTA, de
modo que la emergencia nace con jefe. El índice único parcial garantiza el "≤1".
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.config import get_settings
from app.core.credenciales import construir_token, generar_secreto
from app.core.email import EmailMessage, EmailSender
from app.core.exceptions import AppError, ConflictError
from app.core.roles import ROL_JEFE
from app.core.security import PasswordHasher
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.emergencia_repository import EmergenciaRepository
from app.repositories.log_repository import LogRepository
from app.repositories.rol_seleccion_repository import RolSeleccionRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository
from app.schemas.emergencia import ParticipanteIn


@dataclass
class EmergenciaServiceDeps:
    emergencias: EmergenciaRepository
    usuarios: UsuarioTemporalRepository
    credenciales: CredencialRepository
    roles: RolSeleccionRepository
    logs: LogRepository
    hasher: PasswordHasher
    email: EmailSender


class EmergenciaService:
    def __init__(self, deps: EmergenciaServiceDeps) -> None:
        self._d = deps

    async def crear(
        self,
        *,
        organization_id: int,
        comacon_emergency_id: int | None,
        slug: str,
        modo: str,
        participantes: list[ParticipanteIn],
    ) -> tuple[int, str, int, int]:
        """Crea la emergencia, los usuarios, designa el jefe y emite credenciales.

        Devuelve (emergencia_id, slug, n_credenciales, jefe_usuario_id).
        """
        jefes = [p for p in participantes if p.es_jefe]
        if len(jefes) != 1:
            raise AppError("Debe designarse exactamente un jefe", code="jefe_unico_requerido")

        if await self._d.emergencias.get_by_slug(slug) is not None:
            raise ConflictError("Ya existe una emergencia con ese slug", code="slug_taken")

        emergencia = await self._d.emergencias.create(
            organization_id=organization_id,
            comacon_emergency_id=comacon_emergency_id,
            slug=slug,
            modo=modo,
        )

        await self._d.logs.add(
            emergencia_id=emergencia.id,
            accion="emergencia_creada",
            payload={"organization_id": organization_id, "modo": modo, "slug": slug},
        )

        settings = get_settings()
        expira_at = datetime.now(UTC) + timedelta(hours=settings.CREDENCIAL_EXPIRE_HOURS)
        jefe_usuario_id = 0

        for p in participantes:
            es_jefe = p.es_jefe
            usuario = await self._d.usuarios.create(
                emergencia_id=emergencia.id,
                nombre=p.nombre,
                email=p.email,
                telefono=p.telefono,
                nivel=p.nivel,
                # El jefe se designa: su rol queda fijado (confirmado) ya.
                roles_confirmados=es_jefe,
            )
            if es_jefe:
                jefe_usuario_id = usuario.id
                # I1 "nunca cero": la emergencia nace con jefe activo.
                await self._d.roles.add(
                    emergencia_id=emergencia.id,
                    usuario_temporal_id=usuario.id,
                    rol=ROL_JEFE,
                )

            secreto = generar_secreto()
            cred = await self._d.credenciales.create(
                emergencia_id=emergencia.id,
                usuario_temporal_id=usuario.id,
                token_hash=self._d.hasher.hash(secreto),
                expira_at=expira_at,
            )
            token = construir_token(cred.id, secreto)
            self._enviar_credencial(modo=modo, destinatario=p.email, slug=slug, token=token)
            await self._d.logs.add(
                emergencia_id=emergencia.id,
                accion="credencial_emitida",
                actor_usuario_id=usuario.id,
                payload={"credencial_id": cred.id},  # nunca el token
            )

        return emergencia.id, emergencia.slug, len(participantes), jefe_usuario_id

    def _enviar_credencial(self, *, modo: str, destinatario: str, slug: str, token: str) -> None:
        settings = get_settings()
        # En simulacro, no se contacta a destinatarios reales: se enruta al sink.
        to = destinatario
        if modo == "simulacro":
            if not settings.SIMULACRO_EMAIL_SINK:
                return
            to = settings.SIMULACRO_EMAIL_SINK
        body = (
            f"Acceso a la emergencia '{slug}'.\n"
            f"Tu credencial temporal: {token}\n"
            "No la compartas. Caduca automáticamente."
        )
        self._d.email.send(EmailMessage(to=to, subject=f"Credencial de acceso — {slug}", body=body))
