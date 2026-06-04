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


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class LoggingEmailSender:
    """Emisor por defecto: registra que se encoló un email, SIN el cuerpo.

    Placeholder hasta integrar SMTP/API. No expone el token en logs.
    """

    def send(self, message: EmailMessage) -> None:
        log.info("email_queued", to=message.to, subject=message.subject)


def build_email_sender() -> EmailSender:
    return LoggingEmailSender()
