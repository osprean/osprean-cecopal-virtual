"""Invariantes de corrección a nivel de datos: I1 (mando único) e I6 (tenancy)."""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cecovi_emergencia import CecoviEmergencia
from app.models.cecovi_usuario_temporal import CecoviUsuarioTemporal
from app.repositories.rol_seleccion_repository import RolSeleccionRepository


async def _emergencia(db: AsyncSession, slug: str) -> CecoviEmergencia:
    em = CecoviEmergencia(organization_id=1, slug=slug, modo="real")
    db.add(em)
    await db.flush()
    return em


async def _usuario(db: AsyncSession, emergencia_id: int, email: str) -> CecoviUsuarioTemporal:
    u = CecoviUsuarioTemporal(emergencia_id=emergencia_id, nombre=email, email=email)
    db.add(u)
    await db.flush()
    return u


async def test_i1_un_solo_jefe_activo_por_emergencia(db_session: AsyncSession) -> None:
    em = await _emergencia(db_session, "e1")
    u1 = await _usuario(db_session, em.id, "jefe1@x.es")
    u2 = await _usuario(db_session, em.id, "jefe2@x.es")
    repo = RolSeleccionRepository(db_session)

    await repo.add(emergencia_id=em.id, usuario_temporal_id=u1.id, rol="jefe")

    # Segundo 'jefe' activo en la MISMA emergencia → viola el índice único parcial.
    with pytest.raises(IntegrityError):
        await repo.add(emergencia_id=em.id, usuario_temporal_id=u2.id, rol="jefe")
    await db_session.rollback()


async def test_i1_jefe_no_bloquea_otra_emergencia(db_session: AsyncSession) -> None:
    e1 = await _emergencia(db_session, "e1")
    e2 = await _emergencia(db_session, "e2")
    u1 = await _usuario(db_session, e1.id, "a@x.es")
    u2 = await _usuario(db_session, e2.id, "b@x.es")
    repo = RolSeleccionRepository(db_session)

    # Un jefe por emergencia: ambas conviven (índice parcial es POR emergencia_id).
    await repo.add(emergencia_id=e1.id, usuario_temporal_id=u1.id, rol="jefe")
    await repo.add(emergencia_id=e2.id, usuario_temporal_id=u2.id, rol="jefe")
    await db_session.commit()


async def test_i1_permite_varios_roles_no_jefe(db_session: AsyncSession) -> None:
    em = await _emergencia(db_session, "e1")
    u = await _usuario(db_session, em.id, "a@x.es")
    repo = RolSeleccionRepository(db_session)

    # El índice solo restringe 'jefe'; otros roles pueden repetirse/coexistir.
    await repo.add(emergencia_id=em.id, usuario_temporal_id=u.id, rol="seguridad")
    await repo.add(emergencia_id=em.id, usuario_temporal_id=u.id, rol="logistica")
    await db_session.commit()


async def test_i6_aislamiento_por_emergencia(db_session: AsyncSession) -> None:
    e1 = await _emergencia(db_session, "e1")
    e2 = await _emergencia(db_session, "e2")
    u1 = await _usuario(db_session, e1.id, "a@x.es")
    u2 = await _usuario(db_session, e2.id, "b@x.es")
    repo = RolSeleccionRepository(db_session)

    await repo.add(emergencia_id=e1.id, usuario_temporal_id=u1.id, rol="seguridad")
    await repo.add(emergencia_id=e2.id, usuario_temporal_id=u2.id, rol="sanitario")
    await db_session.commit()

    de_e1 = await repo.list_by_emergencia(e1.id)
    assert [r.rol for r in de_e1] == ["seguridad"]
    assert all(r.emergencia_id == e1.id for r in de_e1)

    de_e2 = await repo.list_by_emergencia(e2.id)
    assert [r.rol for r in de_e2] == ["sanitario"]
