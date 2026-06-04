"""Fake de EmailSender para tests: captura mensajes en memoria.

No es un fixture autodetectado; se importa explícitamente. Permite extraer el
token de la credencial del cuerpo del email (que en producción NUNCA se loguea).
"""

from __future__ import annotations

from app.core.email import EmailMessage


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        self.sent.append(message)

    def token_for(self, email: str) -> str | None:
        for m in self.sent:
            if m.to == email:
                for line in m.body.splitlines():
                    if "credencial temporal:" in line:
                        return line.split("credencial temporal:", 1)[1].strip()
        return None
