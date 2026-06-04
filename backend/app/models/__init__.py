"""Modelos ORM. Importar aquí cada modelo para que Alembic los detecte."""

from app.models.cecovi_credencial import CecoviCredencial
from app.models.cecovi_direccion import (
    CecoviDirAlbergue,
    CecoviDirComunicado,
    CecoviDirGrupo,
    CecoviDirSolicitudMedios,
)
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_log import CecoviLog
from app.models.cecovi_rol_seleccion import CecoviRolSeleccion
from app.models.cecovi_sanitario import CecoviSanAlerta, CecoviSanVictima, CecoviSanZona
from app.models.cecovi_seguridad import (
    CecoviSegAcceso,
    CecoviSegCorte,
    CecoviSegIncidencia,
    CecoviSegPerimetro,
)
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.models.item import Item
from app.models.user import User

__all__ = [
    "CecoviCredencial",
    "CecoviDirAlbergue",
    "CecoviDirComunicado",
    "CecoviDirGrupo",
    "CecoviDirSolicitudMedios",
    "CecoviEmergencia",
    "CecoviLog",
    "CecoviRolSeleccion",
    "CecoviSanAlerta",
    "CecoviSanVictima",
    "CecoviSanZona",
    "CecoviSegAcceso",
    "CecoviSegCorte",
    "CecoviSegIncidencia",
    "CecoviSegPerimetro",
    "CecoviUsuarioTemporal",
    "Item",
    "User",
]
