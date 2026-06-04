# Prompt — Planificación y arquitectura de CECOVI

> Pégalo en la IA con el documento `SRS_CECOVI.docx` adjunto. La especificación adjunta es la **fuente de verdad**; el resumen incluido aquí es solo para orientación rápida.

---

## Rol

Eres un **arquitecto de software senior** especializado en sistemas web multi-tenant y de misión crítica (gestión de emergencias). Tu trabajo es **planificar y diseñar la arquitectura completa** de la plataforma CECOVI a partir de su especificación de requisitos, no escribir el código todavía.

## Contexto del proyecto

CECOVI ("CECOPAL Virtual") es una plataforma web que gestiona una **emergencia mientras está en curso**. Se integra con COMACON, la plataforma núcleo que gestiona el **antes y el después** de la emergencia (organización, organigrama, contactos, recursos e historial). Ambos nombres son **provisionales**: mantenlos como están.

Resumen de decisiones ya cerradas (detalle completo en el SRS adjunto):

- **Plataforma siempre activa** (un único despliegue). No se aprovisiona infraestructura por emergencia; lo que se crea y se archiva es la **entidad emergencia**.
- **Enrutado por path = identificador de emergencia** (p. ej. `/{idEmergencia}`). Ruta inexistente → "no existe"; ruta existente sin credenciales válidas → acceso denegado.
- Cada emergencia pertenece a una **organización de COMACON**.
- **Base de datos compartida** con COMACON. CECOVI tiene **tablas propias y exclusivas** (emergencia, usuarios temporales, roles, registros de acciones…) y, a la vez, **lee y edita los recursos de COMACON** como **referencia viva** (sin copia ni export/import).
- **Múltiples emergencias activas en paralelo** (de una o varias organizaciones).
- La emergencia la **confirma manualmente un operador en COMACON**, lo que dispara la creación en CECOVI y la generación de **N credenciales temporales** (N según el organigrama), enviadas por correo.
- Control de acceso **por rol (RBAC)**. En el primer acceso, cada concejal **elige libremente** uno o varios roles; la selección es **inmutable**.
- Hay **exactamente un jefe/director** por emergencia, con permisos totales.
- **Escalado de un único salto**, de nivel local (CECOPAL) a nivel superior (PMA).
- **Cierre en dos fases**: (1) finalización + PDF global del historial + ventana de lectura configurable; (2) cierre total con archivado y desactivación de la ruta.
- Existe **modo simulacro y modo real**, con flujo idéntico, diferenciados por un indicador.

## Stack base (asumido; ajústalo si la especificación o el equipo indican otra cosa)

- Monorepo **FastAPI** (backend) + **React** SPA servida por FastAPI (plantilla `osprean-webapp-template`).
- **PostgreSQL** como base de datos, **compartida** con COMACON.
- Despliegue en **Kubernetes**, un contenedor por producto, instancia **siempre activa**.
- Autenticación **JWT local**, con abstracción preparada para un **IdP** futuro.
- Vite dev proxy y `Dockerfile` multi-stage.

## Repositorios y rutas

El proyecto vive en un workspace local con estos repos (rutas absolutas):

| Repositorio | Ruta | Rol |
|---|---|---|
| `comacon_web_backend` | `/Users/luisgomez/Desktop/kraken/comacon_web_backend` | Backend de COMACON (núcleo). Posee la base de datos compartida; CECOVI **lee y edita** sus recursos (referencia viva). Revísalo para entender el esquema de recursos. |
| `emergency-manager` | `/Users/luisgomez/Desktop/kraken/emergency-manager` | Front del gestor de emergencia. **Está todo mockeado** (sin backend real). Úsalo como **referencia de UI/UX** y prototipo a conectar con la API y el RBAC reales. |
| `osprean-webapp-template` | `/Users/luisgomez/Desktop/kraken/osprean-webapp-template` | Plantilla base (FastAPI + React, Kubernetes). **Debe copiarse sobre el repo del proyecto** como scaffold inicial. |
| `osprean-cecopal-virtual` | `/Users/luisgomez/Desktop/kraken/osprean-cecopal-virtual` | **Repo del proyecto (destino).** Aquí se copia la plantilla y se desarrolla CECOVI. |

Punto de partida del trabajo:

1. Toma `osprean-webapp-template` y **cópiala sobre `osprean-cecopal-virtual`** como base.
2. Trata `emergency-manager` como referencia de UI/UX (todo mockeado): el plan debe contemplar **sustituir los mocks** por la API real y el control por roles descritos en el SRS.
3. Usa `comacon_web_backend` para entender el **esquema de la base de datos compartida** que CECOVI leerá y editará.

## Invariantes de corrección (RESTRICCIONES DURAS — no las violes)

1. **Un único jefe** con permisos totales por emergencia, en todo momento.
2. **Continuidad de mando**: durante una transferencia, la revocación de escritura del nivel anterior ocurre **solo en el momento de la aceptación** del nuevo nivel. Nunca debe existir un intervalo sin responsable.
3. Tras aceptar, el nivel anterior queda en **solo lectura**; el destinatario obtiene permisos completos y **vuelve a elegir** sus roles.
4. La **selección de roles es inmutable** una vez confirmada.
5. **Dos niveles de mando** y **un único salto** de escalado (local → PMA).
6. **Aislamiento lógico** entre emergencias: toda fila de tablas propias se referencia por `emergencia_id`.
7. **Auditoría inmutable**: todo el historial de acciones es registrable y no manipulable.
8. La plataforma es **siempre activa**; el cierre archiva la emergencia, no apaga la plataforma.

## Tarea

**Paso 0 — Escribe las skills del proyecto (antes de planificar).** Antes de diseñar nada, crea en `osprean-cecopal-virtual/.claude/skills/` las siguientes skills, cada una como una carpeta con su `SKILL.md` (frontmatter YAML con una `description` clara, que es lo que dispara su carga automática). Mantén cada `SKILL.md` conciso:

- `cecovi-invariants/` *(referencia)* — recoge fielmente las **restricciones duras** de la sección «Invariantes de corrección» y del SRS, para que se respeten durante todo el desarrollo.
- `comacon-db-access/` *(referencia)* — reglas de acceso a la base de datos compartida: lectura y edición de recursos de COMACON, frontera de escritura, aislamiento por `emergencia_id` y controles de concurrencia/integridad.
- `osprean-stack/` *(referencia)* — convenciones del monorepo FastAPI + React de la plantilla (estructura, JWT, patrón RBAC, naming).
- `add-role/` *(tarea; añade `disable-model-invocation: true`)* — procedimiento para añadir un rol/vista nuevo de forma consistente en back y front.
- `db-migration/` *(tarea)* — cómo crear y migrar las tablas exclusivas de CECOVI (`emergencia`, `usuarios_temporales`, `logs`…) sin tocar el esquema de COMACON.

Puedes proponer skills adicionales si lo ves necesario; justifícalas. **El resto de la planificación debe hacerse ya respetando estas skills.**

**Paso 1 — Supuestos.** Resume tus supuestos y marca cualquier ambigüedad o conflicto con la especificación.

**Paso 2 — Entregables.** Produce, en **español**, los siguientes entregables:

1. **Arquitectura del sistema** — componentes y sus límites; cómo se relaciona CECOVI con COMACON sobre la base de datos compartida; flujo de despliegue.
2. **Modelo de datos** — esquema de las tablas propias de CECOVI y cómo referencian las tablas de recursos de COMACON; estrategia multi-tenant por `emergencia_id`; tipos, claves y relaciones.
3. **Diseño de la API** — endpoints para: confirmar/crear emergencia, login con credenciales temporales, selección de roles, operación por rol, escalado/transferencia con aceptación, finalización, cierre, y consulta de logs/PDF.
4. **Autenticación y autorización** — ciclo de vida de las credenciales temporales (caducidad, alcance), modelo RBAC, y la **máquina de estados de la transferencia con aceptación** y la degradación a solo lectura.
5. **Multi-tenancy y enrutado** — resolución de `/{idEmergencia}`, comportamiento 404 (no existe) vs. acceso denegado, y aislamiento entre emergencias concurrentes.
6. **Arquitectura frontend** — organización de vistas por rol, vista del jefe, y cómo se materializa el RBAC en la SPA.
7. **Requisitos no funcionales** — cómo se cumplen: auditoría inmutable, **controles de integridad y concurrencia sobre la edición de datos de COMACON**, disponibilidad y seguridad de las credenciales temporales.
8. **Generación de PDF** y gestión de la **ventana de retención** posterior a la finalización.
9. **Modo simulacro vs. real** — cómo se implementa el indicador sin duplicar lógica.
10. **Riesgos y decisiones abiertas** — en especial la **frontera de escritura sobre los datos de COMACON** (hoy "sin restricción"): propón una solución concreta que evite corromper el estado de COMACON. Aborda también: comportamiento de la ruta tras el cierre, caducidad de credenciales, contenido del PDF y modelo de identidad.
11. **Plan de implementación por fases** — hitos, desglose de trabajo (WBS), dependencias y un **MVP demostrable lo antes posible** (hay urgencia operativa y una demo prevista para ayuntamientos y para una reunión con Valencia: prioriza lo que se puede enseñar primero).

## Cómo trabajar

- **Parte de la plantilla**: copia `osprean-webapp-template` sobre `osprean-cecopal-virtual`; reutiliza `emergency-manager` como referencia de UI/UX (mockeada) y `comacon_web_backend` para conocer el esquema de la base de datos compartida.
- Trata el SRS adjunto como fuente de verdad; donde te desvíes, **dilo y justifícalo**.
- Razona paso a paso y **prioriza la corrección** de los invariantes sobre la completitud.
- Usa **diagramas mermaid** para: arquitectura, modelo de datos (ER) y la máquina de estados de credenciales/transferencia.
- Usa **tablas** para el modelo de datos, el catálogo de endpoints y el roadmap.
- Pregunta **solo** si una ambigüedad bloquea de verdad el diseño; en caso contrario, asume y deja constancia de la suposición.
- Mantén COMACON y CECOVI como nombres provisionales.

## Formato de salida

Estructura la respuesta con estos apartados, en este orden:

0. Skills creadas (ruta de cada una y un resumen de su contenido)
1. Supuestos y ambigüedades detectadas
2. Arquitectura del sistema (+ diagrama)
3. Modelo de datos (+ diagrama ER)
4. API
5. Autenticación y autorización (+ máquina de estados de la transferencia)
6. Multi-tenancy y enrutado
7. Frontend
8. Requisitos no funcionales
9. PDF y retención
10. Modos
11. Riesgos y decisiones abiertas (con propuestas concretas)
12. Plan de implementación por fases y MVP