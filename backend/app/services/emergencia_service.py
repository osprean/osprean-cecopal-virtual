"""Alta de emergencia disparada por el webhook de COMACON (P3/P4).

Cambios P3/P4:
- Contrato del webhook: `roles` (lista). Cada rol con `titular` + `suplentes`.
- Por cada rol → 1 credencial MASTER (titular) + 1 credencial BACKUP (compartida
  por los suplentes; quien la use primero queda nominado).
- D4: si el mismo titular aparece en varios roles → UNA sola credencial master
  con `roles` agregados (CSV).
- I1 "nunca cero": la emergencia nace con un jefe (rol='direccion' → titular).
  El índice único parcial del jefe activo en `cecovi_rol_seleccion` garantiza ≤1.

Cómo se nominan los `cecovi_usuario_temporal`:
- Titulares: se crea uno por persona única (dedup por email) y se asigna a la
  master del rol correspondiente.
- Suplentes: NO se crean usuarios al alta; la backup queda sin `usuario_temporal_id`
  hasta el primer login (cuando se nominan).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.credenciales import construir_token, generar_secreto
from app.core.email import EmailMessage, EmailSender
from app.core.exceptions import AppError, ConflictError
from app.core.security import PasswordHasher
from app.repositories.credencial_repository import CredencialRepository
from app.repositories.emergencia_repository import EmergenciaRepository
from app.repositories.log_repository import LogRepository
from app.repositories.rol_seleccion_repository import RolSeleccionRepository
from app.repositories.usuario_temporal_repository import UsuarioTemporalRepository
from app.schemas.emergencia import ParticipanteIn, RolIn
from app.services.tareas_service import crear_tareas_iniciales

ROL_DIRECCION = "direccion"


@dataclass
class EmergenciaServiceDeps:
    emergencias: EmergenciaRepository
    usuarios: UsuarioTemporalRepository
    credenciales: CredencialRepository
    roles: RolSeleccionRepository
    logs: LogRepository
    hasher: PasswordHasher
    email: EmailSender
    db: AsyncSession  # para la sesión de tareas snapshot


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
        roles: list[RolIn],
    ) -> tuple[int, str, int, int, int | None]:
        """Crea la emergencia, los usuarios y emite master/backup por rol.

        Devuelve (emergencia_id, slug, n_master, n_backup, direccion_usuario_id).
        """
        # I1: debe haber exactamente un rol 'direccion'.
        direccion = [r for r in roles if r.rol == ROL_DIRECCION]
        if len(direccion) != 1:
            raise AppError(
                "Debe designarse exactamente un rol 'direccion'",
                code="direccion_unico_requerido",
            )

        if await self._d.emergencias.get_by_slug(slug) is not None:
            raise ConflictError("Ya existe una emergencia con ese slug", code="slug_taken")
        # Dedupe por comacon_emergency_id (índice único parcial; 409 si choca).
        if comacon_emergency_id is not None:
            existing = await self._d.emergencias.get_by_comacon_emergency_id(comacon_emergency_id)
            if existing is not None:
                raise ConflictError(
                    "Esta emergencia COMACON ya tiene CECOVI", code="comacon_emergency_taken"
                )

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

        # --- 1. Dedup titulares por email (D4: roles compuestos) ---
        # email → (ParticipanteIn, list[str] roles_acumulados)
        titulares: dict[str, tuple[ParticipanteIn, list[str]]] = {}
        for r in roles:
            p = r.titular
            entry = titulares.get(p.email)
            if entry is None:
                titulares[p.email] = (p, [r.rol])
            else:
                entry[1].append(r.rol)

        # --- 2. Crear usuario por cada titular único + master con roles agregados ---
        usuario_por_email: dict[str, int] = {}
        master_id_por_rol: dict[str, int] = {}
        direccion_usuario_id: int | None = None
        n_master = 0
        for email, (p, rol_list) in titulares.items():
            usuario = await self._d.usuarios.create(
                emergencia_id=emergencia.id,
                nombre=p.nombre,
                email=p.email,
                telefono=p.telefono,
                nivel=p.nivel,
                roles_confirmados=True,  # los roles vienen de la credencial, ya fijados.
            )
            usuario_por_email[email] = usuario.id
            if ROL_DIRECCION in rol_list:
                direccion_usuario_id = usuario.id
            # I1: pre-rellenar cecovi_rol_seleccion con los roles del titular
            for rol in rol_list:
                await self._d.roles.add(
                    emergencia_id=emergencia.id,
                    usuario_temporal_id=usuario.id,
                    rol=rol,
                )
            secreto = generar_secreto()
            cred = await self._d.credenciales.create(
                emergencia_id=emergencia.id,
                usuario_temporal_id=usuario.id,
                token_hash=self._d.hasher.hash(secreto),
                expira_at=expira_at,
                tipo="master",
                roles=",".join(rol_list),
            )
            for rol in rol_list:
                master_id_por_rol[rol] = cred.id
            n_master += 1
            token = construir_token(cred.id, secreto)
            self._enviar_credencial(
                modo=modo,
                destinatario=p.email,
                slug=slug,
                token=token,
                tipo="master",
                rol=",".join(rol_list),
            )
            await self._d.logs.add(
                emergencia_id=emergencia.id,
                accion="credencial_emitida",
                actor_usuario_id=usuario.id,
                payload={"credencial_id": cred.id, "tipo": "master", "roles": rol_list},
            )

        # --- 3. Backup por rol (1 credencial compartida; sin usuario_temporal_id) ---
        # PRE-CREAMOS los `cecovi_usuario_temporal` de los suplentes (dedup por
        # email) para que el login backup pueda nominar al usuario por email.
        # La credencial backup sigue sin `usuario_temporal_id` hasta el primer login.
        n_backup = 0
        for r in roles:
            if not r.suplentes:
                continue
            for suplente in r.suplentes:
                if suplente.email in usuario_por_email:
                    continue
                u = await self._d.usuarios.create(
                    emergencia_id=emergencia.id,
                    nombre=suplente.nombre,
                    email=suplente.email,
                    telefono=suplente.telefono,
                    nivel=suplente.nivel,
                    roles_confirmados=True,
                )
                usuario_por_email[suplente.email] = u.id
            secreto_b = generar_secreto()
            cred_b = await self._d.credenciales.create(
                emergencia_id=emergencia.id,
                usuario_temporal_id=None,
                token_hash=self._d.hasher.hash(secreto_b),
                expira_at=expira_at,
                tipo="backup",
                roles=r.rol,
            )
            n_backup += 1
            token_b = construir_token(cred_b.id, secreto_b)
            for suplente in r.suplentes:
                self._enviar_credencial(
                    modo=modo,
                    destinatario=suplente.email,
                    slug=slug,
                    token=token_b,
                    tipo="backup",
                    rol=r.rol,
                )
            await self._d.logs.add(
                emergencia_id=emergencia.id,
                accion="credencial_emitida",
                payload={
                    "credencial_id": cred_b.id,
                    "tipo": "backup",
                    "rol": r.rol,
                    "destinatarios": [s.email for s in r.suplentes],
                },
            )

        # P5: snapshot inicial de tareas operativas por rol.
        await crear_tareas_iniciales(self._d.db, emergencia_id=emergencia.id)

        return emergencia.id, emergencia.slug, n_master, n_backup, direccion_usuario_id

    def _enviar_credencial(
        self, *, modo: str, destinatario: str, slug: str, token: str, tipo: str, rol: str
    ) -> None:
        settings = get_settings()
        to = destinatario
        # En modo simulacro, si hay SIMULACRO_EMAIL_SINK configurado, redirige
        # TODOS los emails al sink (un buzón de tests). Si no, sigue enviando al
        # destinatario real (sirve para demos donde quieres ver llegar el email).
        if modo == "simulacro" and settings.SIMULACRO_EMAIL_SINK:
            to = settings.SIMULACRO_EMAIL_SINK
        rol_label = {
            "direccion": "Dirección (Alcaldía)",
            "logistica": "Logística",
            "sanitario": "Sanitario",
            "seguridad": "Seguridad",
            "gabinete": "Gabinete de información",
        }.get(rol, rol)
        tipo_label = "Titular" if tipo == "master" else "Suplente"
        access_url = (
            f"{settings.PUBLIC_FRONTEND_BASE.rstrip('/')}/{slug}"
            if settings.PUBLIC_FRONTEND_BASE
            else f"https://cecovi.osprean.net/{slug}"
        )
        body = (
            f"Acceso a la emergencia '{slug}'\n"
            f"Rol: {rol_label} · {tipo_label}\n"
            f"URL: {access_url}\n"
            f"Credencial temporal: {token}\n\n"
            "No la compartas. Caduca automáticamente."
        )
        html = _render_credencial_html(
            slug=slug,
            rol_label=rol_label,
            tipo=tipo,
            tipo_label=tipo_label,
            token=token,
            access_url=access_url,
            modo=modo,
        )
        self._d.email.send(
            EmailMessage(
                to=to,
                subject=f"🚨 CECOVI · Acceso a la emergencia {slug}",
                body=body,
                html=html,
            )
        )


def _render_credencial_html(
    *, slug: str, rol_label: str, tipo: str, tipo_label: str, token: str, access_url: str, modo: str
) -> str:
    badge_color = "#dc2626" if tipo == "master" else "#f59e0b"
    badge_bg = "#fee2e2" if tipo == "master" else "#fef3c7"
    modo_banner = (
        "<div style=\"background:#dbeafe;color:#1e3a8a;padding:8px 14px;border-radius:8px;"
        "font-size:13px;display:inline-block;margin-bottom:16px\">"
        "🧪 EMERGENCIA EN MODO SIMULACRO</div>"
        if modo == "simulacro"
        else ""
    )
    body_style = (
        "margin:0;padding:32px 16px;background:#f1f5f9;"
        "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
    )
    return f"""<!doctype html>
<html lang="es">
<body style="{body_style}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;
                box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden">
    <tr><td style="background:linear-gradient(135deg,#b91c1c,#7c2d12);padding:24px 32px;color:#fff">
      <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85">
        CECOPAL Virtual · Osprean
      </div>
      <div style="font-size:24px;font-weight:700;margin-top:6px">
        🚨 Acceso de emergencia
      </div>
    </td></tr>
    <tr><td style="padding:32px">
      {modo_banner}
      <p style="margin:0 0 12px;font-size:15px;color:#0f172a">
        Has sido designado en el organigrama del CECOPAL de esta emergencia.
        Entra cuanto antes para coordinarte con tu equipo.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0"
             style="width:100%;margin-top:24px;border-collapse:collapse;background:#f8fafc;
                    border-radius:10px;overflow:hidden">
        <tr>
          <td style="padding:14px 18px;font-size:12px;color:#64748b;letter-spacing:1px;
                     text-transform:uppercase;width:140px;border-bottom:1px solid #e2e8f0">
            Emergencia
          </td>
          <td style="padding:14px 18px;font-size:15px;color:#0f172a;font-weight:600;
                     border-bottom:1px solid #e2e8f0">
            {slug}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px;font-size:12px;color:#64748b;letter-spacing:1px;
                     text-transform:uppercase;border-bottom:1px solid #e2e8f0">Rol</td>
          <td style="padding:14px 18px;font-size:15px;color:#0f172a;font-weight:600;
                     border-bottom:1px solid #e2e8f0">{rol_label}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;font-size:12px;color:#64748b;letter-spacing:1px;
                     text-transform:uppercase">Función</td>
          <td style="padding:14px 18px">
            <span style="background:{badge_bg};color:{badge_color};padding:4px 10px;
                         border-radius:6px;font-size:12px;font-weight:700;letter-spacing:1px">
              {tipo_label.upper()}
            </span>
          </td>
        </tr>
      </table>

      <div style="margin-top:28px;padding:18px;background:#0f172a;border-radius:10px;
                  text-align:center">
        <div style="font-size:11px;color:#94a3b8;letter-spacing:1.5px;
                    text-transform:uppercase;margin-bottom:8px">
          Tu credencial temporal
        </div>
        <code style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;
                     color:#fde68a;word-break:break-all">{token}</code>
      </div>

      <div style="text-align:center;margin-top:28px">
        <a href="{access_url}"
           style="display:inline-block;background:#b91c1c;color:#fff;
                  text-decoration:none;padding:14px 32px;border-radius:10px;
                  font-weight:600;font-size:15px;letter-spacing:.3px">
          Entrar al CECOPAL Virtual →
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.6">
        Si tu credencial es de tipo <strong>Suplente</strong>, se compartirá entre los
        suplentes designados; el primero en entrar quedará nominado. Cuando el titular
        acceda, las credenciales suplentes se invalidan.
      </p>
      <p style="margin:8px 0 0;font-size:12px;color:#64748b">
        Esta credencial caduca automáticamente. No la reenvíes ni la compartas.
      </p>
    </td></tr>
    <tr><td style="background:#f1f5f9;padding:14px 32px;text-align:center;
                   font-size:11px;color:#94a3b8">
      Osprean · Anticipación y precisión en la gestión de emergencias
    </td></tr>
  </table>
</body>
</html>"""
