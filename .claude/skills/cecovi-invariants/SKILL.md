---
name: cecovi-invariants
description: Restricciones duras de corrección de CECOVI (mando único, continuidad de mando en la transferencia, roles inmutables, aislamiento por emergencia_id, auditoría inmutable, plataforma siempre activa). Consúltala SIEMPRE antes de diseñar o tocar mando/transferencia/roles/cierre/multi-tenancy/auditoría.
---

# Invariantes de corrección de CECOVI (RESTRICCIONES DURAS)

Estos invariantes son **fuente de verdad** y prevalecen sobre completitud o comodidad de implementación. Si un cambio puede violarlos, **párate y replantéalo**. El SRS (`SRS_CECOVI.docx`) los amplía; ante conflicto, gana el SRS y se deja constancia.

## I1 — Mando único
- Existe **exactamente un jefe/director con permisos totales por emergencia**, en todo momento. Nunca cero, nunca dos.
- Garantía a nivel de datos: índice único parcial sobre el rol "jefe activo" por `emergencia_id`.

## I2 — Continuidad de mando (transferencia/escalado)
- En una transferencia (CECOPAL → PMA), la **revocación de escritura del nivel anterior ocurre SOLO en el instante de la aceptación** del nuevo nivel.
- **Nunca** debe existir un intervalo sin responsable con escritura. La conmutación es **atómica** (una sola transacción: degradar anterior + promover nuevo).

## I3 — Degradación a solo lectura
- Tras aceptar, el nivel anterior queda en **solo lectura** (no pierde acceso, sí escritura).
- El destinatario obtiene **permisos completos** y **vuelve a elegir** sus roles.

## I4 — Roles inmutables
- La **selección de roles de un usuario es inmutable una vez confirmada**. No hay edición posterior (sí re-elección tras recibir el mando, que es un acto nuevo de un usuario/nivel distinto).

## I5 — Dos niveles, un salto
- **Dos niveles de mando** (local CECOPAL → superior PMA) y **un único salto** de escalado. No hay cadenas de más de un salto.

## I6 — Aislamiento lógico por emergencia
- Toda fila de tablas propias de CECOVI lleva `emergencia_id` y **toda** consulta/escritura se filtra por él. Una emergencia jamás ve datos de otra.

## I7 — Auditoría inmutable
- Todo el historial de acciones es **registrable y no manipulable**: append-only, sin UPDATE/DELETE. Nada de lo operativo escapa al log.

## I8 — Plataforma siempre activa
- Un único despliegue permanente. El **cierre archiva la entidad emergencia y desactiva su ruta**; **no** apaga ni reaprovisiona infraestructura.

## Checklist antes de mergear cambios sensibles
- [ ] ¿El cambio puede dejar 0 o 2 jefes? (I1)
- [ ] ¿La transferencia sigue siendo atómica y sin hueco? (I2)
- [ ] ¿Se respeta la inmutabilidad de roles? (I4)
- [ ] ¿Toda query nueva filtra por `emergencia_id`? (I6)
- [ ] ¿El log sigue siendo append-only? (I7)

Relacionado: [[comacon-db-access]] (frontera de escritura sobre COMACON), [[osprean-stack]] (dónde se materializa el RBAC).
