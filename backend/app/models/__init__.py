"""Modelos ORM. Importar aquí cada modelo para que Alembic los detecte."""

from app.models.cecovi_campo import CecoviCampoReporte, CecoviCampoTarea
from app.models.cecovi_credencial import CecoviCredencial
from app.models.cecovi_direccion import (
    CecoviDirAlbergue,
    CecoviDirComunicado,
    CecoviDirEvacuacion,
    CecoviDirGrupo,
    CecoviDirSolicitudMedios,
)
from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_gabinete import CecoviGabCanal, CecoviGabPublicacion
from app.models.cecovi_log import CecoviLog
from app.models.cecovi_notificacion import CecoviNotificacion
from app.models.cecovi_logistica import (
    CecoviLogiServicio,
    CecoviLogiSolicitud,
    CecoviLogiSuministro,
)
from app.models.cecovi_rol_seleccion import CecoviRolSeleccion
from app.models.cecovi_sanitario import CecoviSanAlerta, CecoviSanVictima, CecoviSanZona
from app.models.cecovi_sesion import CecoviSesion
from app.models.cecovi_tarea import CecoviTarea
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
    "CecoviCampoReporte",
    "CecoviCampoTarea",
    "CecoviCredencial",
    "CecoviDirAlbergue",
    "CecoviDirComunicado",
    "CecoviDirEvacuacion",
    "CecoviDirGrupo",
    "CecoviDirSolicitudMedios",
    "CecoviEmergencia",
    "CecoviGabCanal",
    "CecoviGabPublicacion",
    "CecoviLog",
    "CecoviNotificacion",
    "CecoviLogiServicio",
    "CecoviLogiSolicitud",
    "CecoviLogiSuministro",
    "CecoviRolSeleccion",
    "CecoviSanAlerta",
    "CecoviSanVictima",
    "CecoviSanZona",
    "CecoviSegAcceso",
    "CecoviSegCorte",
    "CecoviSegIncidencia",
    "CecoviSegPerimetro",
    "CecoviSesion",
    "CecoviTarea",
    "CecoviUsuarioTemporal",
    "Item",
    "User",
]
