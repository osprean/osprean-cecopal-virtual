"""Envío de correo (Protocol swappable, como el TokenService).

SEGURIDAD: el token de la credencial viaja SOLO en el cuerpo del email; NUNCA
se registra en logs. El emisor por defecto loguea únicamente metadatos
(destinatario, emergencia), no el cuerpo. La implementación real (SMTP/API) se
añade más adelante reemplazando el emisor; el resto del código no cambia.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.core.logging import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    body: str
    html: str | None = None  # opcional: cuerpo HTML; si está, se envía multipart


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class LoggingEmailSender:
    """Emisor por defecto: registra que se encoló un email, SIN el cuerpo.

    Placeholder hasta integrar SMTP/API. No expone el token en logs.
    """

    def send(self, message: EmailMessage) -> None:
        log.info("email_queued", to=message.to, subject=message.subject)


class BrevoSmtpEmailSender:
    """Emisor SMTP via Brevo (smtp-relay.brevo.com). Env vars:
       BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_PASSWORD,
       BREVO_FROM_ADDRESS (ej. noreply@osprean.com).
    """

    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self._host = host
        self._port = port
        self._user = user
        self._password = password
        self._sender = sender

    def send(self, message: EmailMessage) -> None:
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        if message.html:
            mime = MIMEMultipart("alternative")
            mime["Subject"] = message.subject
            mime["From"] = self._sender
            mime["To"] = message.to
            mime.attach(MIMEText(message.body, "plain", "utf-8"))
            mime.attach(MIMEText(message.html, "html", "utf-8"))
        else:
            mime = MIMEText(message.body, "plain", "utf-8")  # type: ignore[assignment]
            mime["Subject"] = message.subject
            mime["From"] = self._sender
            mime["To"] = message.to
        with smtplib.SMTP(self._host, self._port, timeout=15) as s:
            s.starttls()
            s.login(self._user, self._password)
            s.sendmail(self._sender, [message.to], mime.as_string())
        log.info("email_sent_via_brevo", to=message.to, subject=message.subject)


class FileEmailSender:
    """Emisor de desarrollo: escribe el email entero (incluyendo cuerpo con
    token) a `./var/email_sink/<timestamp>-<to>.txt`. Útil para demos locales.

    NO usar en producción: el token va al disco en plano. Se activa con
    EMAIL_SINK_DIR set (env).
    """

    def __init__(self, base_dir: str) -> None:
        import pathlib
        self._base = pathlib.Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)

    def send(self, message: EmailMessage) -> None:
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        stem = f"{ts}-{message.to.replace('@','_at_')}"
        (self._base / f"{stem}.txt").write_text(
            f"To: {message.to}\nSubject: {message.subject}\n\n{message.body}\n",
            encoding="utf-8",
        )
        # Si el email tiene HTML, lo guardamos junto al txt para inspección.
        if message.html:
            (self._base / f"{stem}.html").write_text(message.html, encoding="utf-8")
        log.info("email_sunk_to_file", to=message.to, path=str(self._base / f"{stem}.txt"))


class DualEmailSender:
    """Combina varios senders: envía a cada uno secuencialmente. Útil en demo:
    SMTP real + sink local (para que los tests capturen tokens)."""

    def __init__(self, *senders: EmailSender) -> None:
        self._senders = senders

    def send(self, message: EmailMessage) -> None:
        for s in self._senders:
            try:
                s.send(message)
            except Exception as exc:
                log.error("email_subsender_failed", sender=type(s).__name__, error=str(exc))


def build_email_sender() -> EmailSender:
    import os
    senders: list[EmailSender] = []
    # Sink local: escribe el cuerpo a archivo (incluye token). Útil dev/demo.
    sink_dir = os.getenv("EMAIL_SINK_DIR")
    if sink_dir:
        senders.append(FileEmailSender(sink_dir))
    # Brevo SMTP real cuando hay password.
    if os.getenv("BREVO_SMTP_PASSWORD"):
        senders.append(
            BrevoSmtpEmailSender(
                host=os.getenv("BREVO_SMTP_HOST", "smtp-relay.brevo.com"),
                port=int(os.getenv("BREVO_SMTP_PORT", "587")),
                user=os.getenv("BREVO_SMTP_USER", "a8009c001@smtp-brevo.com"),
                password=os.environ["BREVO_SMTP_PASSWORD"],
                sender=os.getenv("BREVO_FROM_ADDRESS", "noreply@osprean.com"),
            )
        )
    if not senders:
        return LoggingEmailSender()
    if len(senders) == 1:
        return senders[0]
    return DualEmailSender(*senders)
