# Emergency Manager · Centro Operativo Táctico

> **Plataforma frontend para la coordinación de emergencias en tiempo real, con copiloto LLM, RAG _document-grounded_ sobre el Plan Territorial Municipal (PLATERMU) y un agente geoespacialmente consciente del mapa.**

Aplicación React + TypeScript pensada para sala de mando (CECOP/CECOPAL/PMA). Una pantalla, un mapa táctico común, paneles especializados por rol (Dirección, Seguridad, Sanitario, Logística, Gabinete, Campo), línea de tiempo de incidentes y un copiloto de IA con _function-calling_ que actúa sobre el estado operativo (auto-aplicación con deshacer) y consulta el Plan Municipal indexado vectorialmente en el navegador.

Prototipo construido sobre el caso de uso del **Ayuntamiento de El Álamo (Madrid)** — el PLATERMU empaquetado en `src/features/ai-ops/knowledge/platermu.md` es la base de conocimiento que el copiloto cita literalmente al operador.

> **Estado**: prototipo operativo con datos _mock_. Sin backend propio. La capa de servicios (OpenRouter, geocodificación, embeddings) está aislada y lista para conectarse a una API real.
>
> **Última iteración**: incidencias de seguridad creables desde IA y desde el mapa con capa propia, agente con consciencia geoespacial (`map_*`), perímetros circulares, RAG con rerank híbrido y _auto-apply + deshacer_ en lugar de doble confirmación.

---

## Tabla de contenidos

1. [Visión general y casos de uso](#1-visión-general-y-casos-de-uso)
2. [Arquitectura](#2-arquitectura)
3. [Stack técnico](#3-stack-técnico)
4. [Puesta en marcha](#4-puesta-en-marcha)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Estructura del repositorio](#6-estructura-del-repositorio)
7. [Modelo de datos y stores](#7-modelo-de-datos-y-stores)
8. [Roles tácticos (tabs)](#8-roles-tácticos-tabs)
9. [Módulo de mapa](#9-módulo-de-mapa)
10. [Copiloto Ops AI](#10-copiloto-ops-ai)
11. [Pipeline RAG (document-grounded)](#11-pipeline-rag-document-grounded)
12. [Catálogo de tools](#12-catálogo-de-tools)
13. [Hooks útiles](#13-hooks-útiles)
14. [Convenciones de código](#14-convenciones-de-código)
15. [Scripts disponibles](#15-scripts-disponibles)
16. [Limitaciones conocidas](#16-limitaciones-conocidas)
17. [Roadmap](#17-roadmap)
18. [Licencia](#18-licencia)

---

## 1. Visión general y casos de uso

### 1.1 ¿Qué es?

Un **Centro Operativo Táctico** en el navegador: una UI _full-screen_ orientada a coordinación de emergencias municipales con un copiloto LLM que (a) ejecuta acciones operativas reales contra los stores de la app — incluidas acciones sobre el mapa que se auto-aplican y son reversibles desde la tarjeta del chat — y (b) responde preguntas sobre el Plan Municipal citando el documento literalmente.

### 1.2 Casos de uso cubiertos

| Caso | Quién lo usa | Qué hace |
| ---- | ------------ | -------- |
| **Coordinación de incidentes activos** | Director de emergencia | KPIs, decisiones, evacuaciones, comunicados sobre el mapa común. |
| **Gestión de perímetros y cortes** | Jefe de Seguridad / FCSE | Perímetros (polígono o **círculo con radio**), cortes viales, controles de acceso. Creables desde la barra de mapa o desde el chat. |
| **Registro de incidencias de seguridad** | Jefe de Seguridad / IA | Reporta incidencias localizadas (persona perdida, conato, robo…) desde el mapa o desde el chat; quedan en su propia capa y en el _timeline_. |
| **Triaje y derivación sanitaria** | Coordinador sanitario | Registra víctimas con `TriageColor`, asigna ambulancias, deriva a hospital. |
| **Inventario y suministros** | Logística | Crea recursos, ajusta stock, gestiona peticiones, vehículos y servicios. |
| **Comunicación institucional** | Gabinete de prensa | Comunicados, canales, RRSS, peticiones de medios. |
| **Reportes desde el terreno** | Puesto avanzado (PMA) | Reportes por voz (Web Speech API), fotografías, solicitud de apoyo. |
| **Consulta del Plan Municipal** | Cualquier rol | Pregunta en lenguaje natural sobre PLATERMU; respuesta con citas literales (`chunk_id`, sección, página). |
| **Ingesta de documentación adicional** | Operador | Sube PDFs en runtime desde el propio chat; se indexan vectorialmente en el navegador. |
| **Consciencia geoespacial del agente** | Operador / IA | El copiloto consulta qué hay desplegado en el mapa y dónde, antes de actuar (ej. _"crea un perímetro de 300 m alrededor del origen"_, _"qué tengo a menos de 500 m de VIC-003"_). |

### 1.3 Flujos típicos

1. **"Corta la calle Mayor por incendio activo"** → el copiloto geocodifica la dirección, **aplica el cierre al instante** y deja una tarjeta en el chat con la frase _"Cortada Calle Mayor"_ y un botón **Deshacer** durante una ventana corta.
2. **"Perímetro de exclusión de 250 m alrededor del origen"** → el copiloto resuelve `centerRef='emergency'`, pinta un perímetro **circular** (paleta táctica o color indicado por el operador) y queda deshacible.
3. **"Asigna AMB-04 a VIC-003"** → acción operativa directa contra `sanitarioStore`, respuesta breve `"AMB-04 asignada a VIC-003"`.
4. **"¿Cuál es el procedimiento de confinamiento por incidente con GLP?"** → el copiloto llama `rag_query`, recibe fragmentos del PLATERMU y responde con bloque `Respuesta:` + `Fuente:` citando chunk + sección + página. Si la primera consulta no encuentra evidencia, **reintenta automáticamente** con vocabulario más cercano al Plan antes de rechazar.
5. **"Crea una incidencia: persona perdida en el parque"** → el copiloto pide _solo el dato que falta_ (ubicación o título) y, una vez completo, registra la incidencia en su capa con coordenadas reales — sin doble confirmación.
6. **"Lista los albergues con ocupación >80%"** → consulta de estado de la sala (no documental), respuesta tabulada en lenguaje natural.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      TacticalLayout                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ TopNav  (tabs · logo · OpsAI · Timeline)             │    │
│  └──────────────────────────────────────────────────────┘    │
│  ┌──────────────────────┬──────────────┬────────────────┐    │
│  │                      │ Timeline     │ OpsAI Drawer   │    │
│  │   TabRouter          │  Drawer      │ (chat + RAG    │    │
│  │   ├─ DireccionPage   │              │  + upload PDF) │    │
│  │   ├─ SeguridadPage   │              │                │    │
│  │   ├─ SanitarioPage   │              │ ┌────────────┐ │    │
│  │   ├─ LogisticaPage   │              │ │RagStatusBar│ │    │
│  │   ├─ GabinetePage    │              │ └────────────┘ │    │
│  │   └─ CampoPage       │              │ ┌────────────┐ │    │
│  │                      │              │ │AppliedCards│ │    │
│  │                      │              │ │  + Undo    │ │    │
│  │                      │              │ └────────────┘ │    │
│  └──────────────────────┴──────────────┴────────────────┘    │
└─────────────────────────────────────────────────────────────┘
              │                       ▲
              ▼                       │
        Zustand stores ◀─── tools ◀── Ops AI orchestrator
              │              (auto-apply +    │
              │               undo set)       │
              │                               ▼
              │                         ┌──────────────┐
              │                         │ RAG pipeline │
              │                         │ (IndexedDB + │
              │                         │  E5 multi +  │
              │                         │  rerank      │
              │                         │  híbrido)    │
              │                         └──────────────┘
              ▼                               ▼
        mocks/*  ────────────  OpenRouter (LLM via fetch)
```

### Capas

| Capa            | Responsabilidad                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| `layouts/`      | Esqueleto persistente (TopNav, drawers, mapa de fondo).                         |
| `pages/`        | Una página por rol táctico. Cada una compone su panel y _overlays_ sobre el mapa.|
| `features/`     | _Cross-cutting features_: enrutado de tabs, copiloto AI, pipeline RAG.          |
| `modules/map/`  | Encapsula Leaflet (capas base, marcadores, dibujo, _popups_, _snapshots_, capas por rol). |
| `components/`   | Componentes reutilizables (base, feedback, data, providers, timeline).          |
| `store/`        | Stores Zustand — una _slice_ por dominio operativo.                             |
| `mocks/`        | Datos semilla; alimentan los stores en su estado inicial.                       |
| `services/`     | Integraciones externas (OpenRouter, geocoding Nominatim).                       |
| `hooks/`        | Reutilizables: reloj táctico, _fake realtime_, reconocimiento de voz.           |
| `theme/`        | Tema Chakra (paleta táctica, tipografías, _component overrides_).               |
| `types/`        | Modelos compartidos (Emergency, GeoPoint, TriageColor, Severity, …).            |
| `utils/`        | Formateadores, persistencia de mapa, reescritura asistida por IA.               |

---

## 3. Stack técnico

| Capa | Tecnología |
| ---- | ---------- |
| UI | **React 18** + **TypeScript 6** + **Vite 8** (HMR, `tsc -b` en build). |
| Diseño | **Chakra UI 2** + **@emotion** + **framer-motion**. |
| Estado | **Zustand 4** — una _slice_ por dominio, selectors exportados. |
| Mapa | **Leaflet 1.9** + **react-leaflet 4** + iconos SVG generados al vuelo. |
| LLM | **OpenRouter** (cliente _fetch_ propio) — `function-calling` con `temperature=0`. |
| Embeddings | **@xenova/transformers** (`Xenova/multilingual-e5-small`, 384 dims, ONNX/WASM en navegador). |
| PDF | **pdfjs-dist 4** — extracción de bloques (texto + heurística de tablas/headings). |
| Vector store | **IndexedDB** vía **idb** — búsqueda cosine exhaustiva + rerank híbrido (sin ANN para <5K chunks). |
| Geocoding | **Nominatim** (OpenStreetMap) — forward geocoding de calles/zonas. |
| Captura | **html2canvas** — _snapshots_ de mapa para comunicados. |
| Iconografía | **react-icons** (Material Icons). |
| Seguridad supply chain | **`protobufjs` 7.6.0** forzado vía `resolutions` (parche Dependabot). |

---

## 4. Puesta en marcha

### 4.1 Requisitos

- **Node.js ≥ 20**
- **Yarn** recomendado (hay `yarn.lock` y se usan `resolutions`). npm/pnpm también funcionan, pero las resoluciones puede que no se respeten.
- Navegador moderno con **IndexedDB** y, opcionalmente, **WebSpeech API** para dictado por voz en el chat de IA y reportes por voz en Campo.

### 4.2 Instalación

```bash
git clone <repo>
cd emergency-manager
yarn install
```

### 4.3 Configuración mínima

Crea un fichero `.env.local` en la raíz:

```bash
VITE_OPENROUTER_API_KEY=sk-or-...                  # opcional, sin ella el copiloto se desactiva
VITE_OPENROUTER_MODEL=anthropic/claude-3.5-haiku   # opcional
```

### 4.4 Ejecución

```bash
yarn dev          # Vite en http://localhost:5173
yarn lint         # ESLint sobre todo el repo
yarn build        # tsc -b && vite build
yarn preview      # sirve el bundle de producción
```

> Al primer arranque del copiloto, el navegador descarga el modelo de embeddings (~120 MB cuantizados) y lo cachea en IndexedDB. Las siguientes sesiones ya están <2 s.
>
> El navegador pedirá permiso de geolocalización al cargar; si se concede, se centra el mapa en la posición del usuario.

---

## 5. Variables de entorno

Todas las variables del cliente deben ir prefijadas con `VITE_` (regla de Vite).

| Variable                  | Por defecto                  | Descripción                                              |
| ------------------------- | ---------------------------- | -------------------------------------------------------- |
| `VITE_OPENROUTER_API_KEY` | _(vacío)_                    | Clave de OpenRouter. Sin ella, el botón de IA se desactiva. |
| `VITE_OPENROUTER_MODEL`   | `anthropic/claude-3.5-haiku` | Modelo usado por el orquestador.                         |

> ⚠️ La API key viaja en el bundle del navegador (proyecto _frontend-only_). **Rótala antes de cualquier despliegue público** y/o introduce un proxy backend que firme las llamadas.

---

## 6. Estructura del repositorio

```
emergency-manager/
├── public/                       # estáticos (logos, favicons, osprean.png)
├── src/
│   ├── App.tsx                   # punto de montaje: TacticalLayout + TabRouter
│   ├── main.tsx                  # bootstrap React + ChakraProvider + tema
│   ├── layouts/
│   │   ├── TacticalLayout.tsx    # shell: TopNav + main + drawers
│   │   └── TopNav.tsx
│   ├── features/
│   │   ├── TabRouter.tsx         # TabKey → Page component
│   │   └── ai-ops/
│   │       ├── OpsAIButton.tsx       # entrada en TopNav
│   │       ├── OpsAIDrawer.tsx       # chat lateral (input, dictado, upload PDF,
│   │       │                         #              tarjetas de acción aplicada + Deshacer)
│   │       ├── aiOpsStore.ts         # historial, AppliedAction + undoSet, busy/error
│   │       ├── orchestrator.ts       # bucle function-calling (MAX_TURNS=6, abortable)
│   │       ├── tools.ts              # ~65 tools (definition + handler), incluye map_*
│   │       ├── knowledge/
│   │       │   └── platermu.md       # Plan Municipal empaquetado (~1k líneas)
│   │       └── rag/                  # pipeline document-grounded
│   │           ├── ragService.ts     # ingest / query / rerank híbrido / status
│   │           ├── embeddings.ts     # E5 multilingual-small en transformers.js
│   │           ├── vectorStore.ts    # IndexedDB + cosine exhaustivo + listDocs
│   │           ├── chunker.ts        # semántico, respeta tablas y breadcrumbs
│   │           ├── markdownExtractor.ts  # Markdown → DocumentBlock[]
│   │           ├── pdfExtractor.ts       # PDF (pdfjs) → DocumentBlock[]
│   │           ├── seedPlatermu.ts       # ingesta idempotente al abrir el drawer
│   │           ├── RagStatusBar.tsx      # progreso de descarga/embed/index
│   │           ├── types.ts              # DocumentBlock, RagChunk, RagDecision…
│   │           └── index.ts
│   ├── pages/
│   │   ├── direccion-page/       # vista del director de emergencia
│   │   ├── seguridad-page/       # FCSE: perímetros, cierres, controles, INCIDENCIAS
│   │   ├── sanitario-page/       # triaje, ambulancias, hospitales
│   │   ├── logistica-page/       # vehículos, suministros, servicios
│   │   ├── gabinete-page/        # comunicados, medios, redes
│   │   └── campo-page/           # vista del puesto avanzado
│   ├── modules/map/              # capa Leaflet (markers, dibujo, popups, layers por rol)
│   ├── components/
│   │   ├── base/                 # primitivos UI tácticos
│   │   ├── providers/            # ChakraProvider configurado
│   │   ├── OspreanLogo.tsx
│   │   ├── TimelineDrawer.tsx
│   │   └── timelineStore.ts
│   ├── store/                    # 17 stores Zustand
│   ├── mocks/                    # datos semilla por dominio
│   ├── services/                 # openrouter, geocoding
│   ├── hooks/                    # useTacticalClock, useFakeRealtime, useVoiceRecognition
│   ├── theme/                    # colors, typography, components, index
│   ├── types/                    # modelos TS por dominio
│   └── utils/                    # format, mapPersistence, aiRewrite
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── eslint.config.js
└── package.json
```

---

## 7. Modelo de datos y stores

Estado global gestionado con Zustand. Cada _slice_ es independiente y expone state + setters mínimos tipados, con selectors exportados para evitar _re-renders_ innecesarios.

| Store                | Dominio operativo                                                |
| -------------------- | ---------------------------------------------------------------- |
| `emergencyStore`     | Emergencias activas + emergencia seleccionada.                   |
| `alertsStore`        | Alertas críticas; selector `selectUnacknowledgedCount`.          |
| `incidentsStore`     | Incidentes registrados, _timeline-friendly_.                     |
| `resourcesStore`     | Recursos genéricos sobre el mapa.                                |
| `direccionStore`     | Decisiones, evacuaciones, comunicados, albergues, grupos.        |
| `seguridadStore`     | Perímetros (polígono o **círculo**), cortes, controles, **incidencias**. |
| `sanitarioStore`     | Víctimas (con `TriageColor`), ambulancias, hospitales, zonas.    |
| `logisticaStore`     | Vehículos, inventario, peticiones, servicios afectados.          |
| `gabineteStore`      | Notas de prensa, canales activos, peticiones de medios.          |
| `campoStore`         | Tareas y reportes del puesto avanzado.                           |
| `drawingStore`       | Estado del dibujo libre sobre el mapa.                           |
| `mapLayerStore`      | Capa base + filtros de marcadores por rol.                       |
| `mapFlyStore`        | Cola de _fly-to_ (centrar el mapa desde otra vista).             |
| `mapViewStore`       | Ubicación del usuario, zoom/center recordados.                   |
| `realtimeStore`      | Simulación de telemetría en tiempo real.                         |
| `tabsStore`          | Pestañas + tab activa + badges.                                  |
| `timelineStore`      | Eventos cronológicos consolidados (en `components/`).            |
| `aiOpsStore`         | Mensajes del chat + `AppliedAction` con `undoSet` por _tool call_. |

Los **tipos** correspondientes viven en `src/types/` (un archivo por dominio + `common.ts` con primitivos como `ID`, `GeoPoint`, `Severity`, `TriageColor`, etc.).

---

## 8. Roles tácticos (tabs)

Las seis pestañas representan los roles que conviven en una sala de mando estilo ICS / Plan de Emergencias Municipal:

| Tab            | Foco principal                                                                  |
| -------------- | ------------------------------------------------------------------------------- |
| **Dirección**  | Resumen ejecutivo, KPIs globales, decisiones, evacuaciones, comunicados, albergues, grupos de acción. |
| **Seguridad**  | FCSE, perímetros (polígono o círculo), cortes viales, controles de acceso, evacuación poblacional, **registro de incidencias** (capa propia, creables desde la barra de mapa o desde el chat de IA). |
| **Sanitario**  | Triaje (verde/amarillo/rojo/negro), ambulancias, hospitales, zonas sanitarias (triage-point, first-aid). |
| **Logística**  | Vehículos, suministros, peticiones, servicios (agua/luz/gas/telecom/saneamiento), maquinaria. |
| **Gabinete**   | Comunicados, prensa, RRSS, peticiones de medios, gestión de canales.            |
| **Campo**      | Vista del puesto avanzado: tareas, reportes por voz, fotografías, petición de apoyo. |

Cada página compone:
1. Un **panel lateral / header** con KPIs y acciones del rol.
2. Una **capa de marcadores** específica sobre el mapa (`*MapLayers.tsx`).
3. Sus propios **modales / formularios** (`*ActionModals.tsx`, `SendMapModal.tsx`, `*ActionToolbar.tsx`).

---

## 9. Módulo de mapa

`src/modules/map/` encapsula Leaflet:

- `TacticalMap.tsx` — `MapContainer` raíz con `LayersControl` (calle / satélite), eventos de _baselayerchange_ sincronizados al store, _fly-to_ reactivo.
- `markers.ts` + `seguridadMarkers.ts` + `iconSvg.ts` — generación dinámica de iconos SVG (color por severidad / triaje / estado / tipo de incidencia).
- `MapDrawingLayer.tsx` + `MapDrawingToolbar.tsx` — dibujo libre con polilíneas, polígonos y _free draw_; persiste vía `utils/mapPersistence`.
- `PopupCard.tsx` — _popup_ Chakra-themed reutilizable para todas las entidades.
- `SeguridadMapLayers.tsx`, `SanitarioMapLayers.tsx`, `DireccionMapLayers.tsx` — capas declarativas por rol; respetan `mapLayerStore.selectHideOtherMarkers`. La capa de Seguridad incluye perímetros polígono **y círculo**, cierres, checkpoints e **incidencias**.
- `SeguridadActionToolbar.tsx` — barra contextual para crear incidencias, cierres, perímetros y checkpoints clicando en el mapa.
- `SendMapModal.tsx` — usa `html2canvas` para enviar un _snapshot_ del mapa actual a un canal.

---

## 10. Copiloto Ops AI

Implementado en `src/features/ai-ops/`. Es un asistente conversacional con **doble responsabilidad**:

1. **Acciones sobre la sala** — ejecutar tools que mutan los stores Zustand (asignar ambulancia, cortar calle, registrar incidencia, publicar comunicado…). Las acciones de mapa se **auto-aplican** y se pueden **deshacer** desde la tarjeta del chat.
2. **Consultas al Plan Municipal** — responder preguntas documentales con citas literales del PLATERMU vía RAG (rerank híbrido).

### 10.1 Componentes

- **`OpsAIButton`** — botón en el `TopNav` (deshabilitado si no hay `VITE_OPENROUTER_API_KEY`).
- **`OpsAIDrawer`** — chat lateral persistente. Incluye:
  - Mensajes del usuario / IA con tarjetas de **acción aplicada + botón _Deshacer_**.
  - Errores del LLM en lenguaje natural (sin tono técnico).
  - `RagStatusBar` con el progreso de ingesta de documentos.
  - **Adjuntar PDF** (clip): cualquier PDF se ingesta y se indexa en runtime sin recargar.
  - **Dictado por voz** (WebSpeech) directamente en el input.
  - Botón **Detener**: aborta la generación en curso (signal de aborto al fetch).
- **`aiOpsStore`** — historial, _applied actions_ con su `undoSet` (ids creados durante la acción) y estado del orquestador.

### 10.2 Orquestador

`features/ai-ops/orchestrator.ts` implementa un bucle clásico de _function-calling_:

1. Envía el mensaje del usuario al LLM junto al catálogo de tools.
2. Si el LLM devuelve `tool_calls`, los ejecuta secuencialmente contra los stores (`executeTool`).
3. Cada acción de mapa se **aplica al instante** y deja un `AppliedAction` con un `undoSet` (ids creados) en el mensaje del chat.
4. Devuelve los resultados al LLM para que componga la respuesta final.
5. Repite hasta `MAX_TURNS = 6` o hasta que no haya más `tool_calls`.

**Parámetros de inferencia**: `temperature=0`, `top_p=0` → decodificación determinista. Es lo que el modo _document-grounded_ exige (fidelidad literal a fragmentos) y también beneficia a las acciones operativas (mismas entradas → misma asignación).

**Aborto**: cada ejecución acepta un `AbortSignal`. El botón _Detener_ lo dispara y el bucle sale limpio sin escribir mensajes de error.

### 10.3 System prompt (claves)

Calibrado para sala de coordinación, español, tono de radio-operador. Las restricciones más importantes:

- **RAG estricto**: para cualquier pregunta sobre el Plan, llama SIEMPRE a `rag_query`. Está prohibido inventar, inferir o completar procedimientos con conocimiento externo.
- **Reintento RAG**: si el primer `rag_query` devuelve `no-hits` / `below-threshold`, el modelo **reformula con vocabulario del Plan** y reintenta UNA vez antes de rechazar (ejemplos en el prompt: _"fuga de gas"_ → _"protocolo Naturgy GLP fuga"_, _"cuándo se evacúa"_ → _"fase situación 2 evacuación"_).
- **Formato obligatorio de respuestas documentales**: bloque `Respuesta:` + bloque `Fuente:` con `chunk_id · sección · página`. Fidelidad literal en teléfonos, calles, capacidades y nombres propios — sin redondeos ni reformulaciones.
- **Estados RAG**: `ok` (cita y sintetiza), `empty` (Plan no cargado), `no-hits` / `below-threshold` (responde literalmente _"La información no está disponible…"_).
- **Acciones de mapa**: **auto-aplicación inmediata**. Prohibido usar la palabra "PROPUESTA" o pedir confirmación. Tras ejecutarlas, una sola frase corta en pasado/presente ("Cortada Calle Mayor", "Perímetro creado en el sector norte"). Si el operador pide revertir, se recurre a la tarjeta _Deshacer_ o a la tool inversa correspondiente.
- **Acciones puramente operativas** (asignar, derivar, cambiar estado): se aplican inmediatamente y se confirman con una frase corta.
- **Consciencia geoespacial**: el agente conoce las tools `map_get_emergency`, `map_list_points`, `map_nearby` y las usa antes de crear cosas relativas al mapa.
- **Perímetros circulares**: cuando el operador habla de "radio", "X metros alrededor de…" o "círculo de seguridad", el agente usa `seguridad_create_perimeter` en modo **círculo** con `radiusMeters` + `centerRef='emergency'|VIC-XXX|AMB-XX` o `centerLat/centerLng`. El operador puede pedir un **color** específico (paleta táctica o hex CSS) y se pasa por `color`.
- **Incidencias de seguridad**: si faltan título o ubicación, el agente pide **un solo dato por turno**; severidad es opcional con default `medium`. Sin confirmaciones encadenadas.
- **Identificadores**: víctimas por código (`VIC-003`), ambulancias/vehículos por indicativo (`AMB-04`), calles por nombre, hospitales por nombre. Nunca inventar IDs internos.
- **Borrar vs reabrir**: `*_remove_*` elimina; `seguridad_lift_closure` queda como histórico.

### 10.4 Auto-apply + Deshacer

Cada handler de mapa devuelve, además del `message`, un objeto `applied: AppliedAction` con:

```ts
{
  kind: "close_street" | "create_perimeter" | "create_checkpoint"
      | "register_victim" | "add_zone" | "register_incident",
  summary: "Cortada Calle Mayor",
  detail: "Madrid Centro · Motivo: incendio",
  undo: { closures?: string[], perimeters?: string[], … },  // ids creados
  appliedAt: ISO,
}
```

La tarjeta correspondiente en el chat muestra ese `summary`/`detail` y un botón **Deshacer** que invoca `undoAppliedAction(applied)` — éste recorre el `undoSet` y elimina del store correspondiente todos los ids creados durante la acción. Tras deshacer, la tarjeta queda marcada `status: "undone"` y el botón desaparece.

### 10.5 Servicios externos

- `services/openrouter.ts` — cliente _fetch_ minimal sobre `https://openrouter.ai/api/v1/chat/completions`, con soporte de `AbortSignal`.
- `services/geocoding.ts` — _forward geocoding_ vía Nominatim para resolver nombres de calles a coordenadas (modo punto y modo polígono).

---

## 11. Pipeline RAG (document-grounded)

Implementado en `src/features/ai-ops/rag/`. Permite consultar el Plan Municipal (y cualquier PDF que el operador suba en runtime) con **citas literales** y **rechazo explícito** cuando no hay evidencia suficiente.

### 11.1 Filosofía

> Si en cualquier paso del pipeline se pierde la trazabilidad documento/página/sección, la cita al operador no es fiable. Por eso todos los tipos llevan los campos mínimos para reconstruir _"de qué documento, qué página y qué sección sale esto"_ en cualquier momento.

### 11.2 Etapas

```
┌────────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
│ extractor  │───►│ chunker  │───►│ embed E5 │───►│ IndexedDB   │───►│ ragQuery     │
│ (MD / PDF) │    │ semántico│    │  384 d.  │    │ (cosine     │    │  + rerank    │
└────────────┘    └──────────┘    └──────────┘    │  exhaustivo)│    │  híbrido     │
                                                  └─────────────┘    │ (0.7 cos +   │
                                                                     │  0.3 keyword)│
                                                                     └──────────────┘
```

| Etapa | Archivo | Notas |
| ----- | ------- | ----- |
| **Extracción Markdown** | `markdownExtractor.ts` | Convención `<!-- SECTION:clave -->` para simular paginación. Conservador: no infiere jerarquías ausentes. |
| **Extracción PDF** | `pdfExtractor.ts` | `pdfjs-dist` agrupa items en líneas, detecta tablas por patrón de gaps X, headings por tamaño de fuente, listas por prefijo. **No** hace OCR — si el PDF es un escaneo, se rechaza con mensaje claro. |
| **Chunking semántico** | `chunker.ts` | 300–800 tokens ideal, 1200 hard-max. Tablas y listas **indivisibles**. No cruza headings nivel ≤ 2. Preserva _breadcrumb_ jerárquico en el texto del chunk. |
| **Embeddings** | `embeddings.ts` | `Xenova/multilingual-e5-small` cuantizado (~120 MB ONNX). Prefijos `query:` / `passage:` obligatorios para E5. Normalizado L2 → dot product = cosine. Singleton, primer arranque 5–20 s. |
| **Vector store** | `vectorStore.ts` | IndexedDB vía `idb`. Búsqueda cosine **exhaustiva** (sin ANN) — trivial para <5K chunks. Versionado por `embeddingModel`: cambiar modelo purga vectores incompatibles. |
| **Query + rerank híbrido** | `ragService.ts` | `RAG_TOPK=8`, `RAG_THRESHOLD=0.35`, `RAG_COSINE_WEIGHT=0.7`, `RAG_KEYWORD_WEIGHT=0.3`. Devuelve `RagDecision` (`ok`, `empty-index`, `no-hits`, `below-threshold`). |

### 11.3 Rerank híbrido

El score que se compara con el threshold no es el coseno puro, sino:

```
score = 0.7 · cosine + 0.3 · keyword_overlap_ratio
```

- **`keyword_overlap_ratio`**: ratio [0,1] de tokens de la consulta que aparecen literalmente en el chunk (cobertura, no frecuencia).
- **Tokenización**: se preservan acrónimos en mayúsculas del texto original (CECOPAL, GLP, SEVESO) **antes** de bajar a minúsculas. Tokens alfanuméricos de ≥3 chars; números de ≥2 dígitos (teléfonos, códigos postales).
- **Stopwords**: lista mínima en español. NO se filtran tecnicismos cortos (`GLP`, `112`, `PMA`, `PRL`…).
- **Candidate pool**: `4 × topK` antes del rerank para que el boost por keyword pueda **rescatar** chunks que el coseno solo había hundido.

Sin este rerank, preguntas con jerga muy exacta (`"teléfono Naturgy GLP"`, `"Calle Real km 3"`) se hundían bajo chunks semánticamente parecidos pero sin el dato concreto. Con el rerank, esos chunks suben porque comparten 2–3 tokens literales clave.

### 11.4 Decisiones de diseño

- **Threshold 0.35** (sobre score híbrido) ≈ equivalente al 0.45 anterior sobre coseno puro, pero ahora un chunk con keyword strong puede pasar aunque su coseno sea más bajo. Sigue siendo conservador para no inducir alucinaciones.
- **Top-K = 8**: preguntas amplias ("qué grupos de acción hay", "fases de emergencia", "directorio") necesitan más contexto. Con 5 se quedaban listas incompletas.
- **`temperature=0`** en el LLM: la respuesta debe ser fiel al fragmento, no queremos _sampling_.
- **Sin ANN**: para <5K chunks la búsqueda exhaustiva en 384 dims tarda <50 ms; añadir HNSW/IVF es complejidad innecesaria. Sustituir si el corpus crece.
- **Modelo multilingüe pequeño**: el PLATERMU es español técnico con tecnicismos jurídicos (CECOPAL, PLATERCAM…); un modelo solo-inglés perdería señal. Modelos "base" (~440 MB) son inviables para primer uso.
- **Reintento desde el LLM**, no desde el servicio: la reformulación es _semántica_ (cambia el vocabulario, no el ranking). Hacerla desde el modelo aprovecha su conocimiento del Plan ya cargado en contexto.

### 11.5 Ingesta inicial (PLATERMU)

`seedPlatermu.ts` precarga el Plan empaquetado en `knowledge/platermu.md` al abrir el drawer por primera vez. Es **idempotente**: si el documento ya está indexado con el modelo de embeddings actual, no vuelve a procesarlo. Si falla, se permite reintento en la siguiente apertura.

### 11.6 Ingesta en runtime (PDFs subidos)

Desde el drawer, el operador puede subir cualquier PDF (botón _Adjuntar_). El pipeline:
1. Genera un `docId` estable: `pdf-<slug>-<hash4bytes>`.
2. Extrae bloques con `pdfExtractor`.
3. Reutiliza el resto del pipeline (chunk → embed → index).
4. Emite eventos de progreso a `RagStatusBar` (extracción página N/total, embedding done/total, indexing).
5. Mientras hay ingesta en curso, el input del chat se **bloquea** para no responder consultas con un índice incompleto.

Si el PDF es un escaneo sin capa de texto, `extractPdf` devuelve bloques vacíos y `ragService` rechaza la ingesta con un mensaje explícito.

### 11.7 Tools RAG expuestas al LLM

- `rag_query(consulta)` — devuelve `RAG_STATUS=ok|empty|no-hits|below-threshold` + fragmentos con metadata.
- `rag_documentos_disponibles()` — lista los documentos indexados (PLATERMU + PDFs subidos).

---

## 12. Catálogo de tools

`features/ai-ops/tools.ts` declara ~65 tools. Cada una expone:

- `definition`: JSON Schema enviado al LLM en el campo `tools` de OpenRouter.
- `handler`: ejecuta contra los stores Zustand y retorna `{ ok, message, data?, applied? }`.

### 12.1 Mapa (auto-aplicación + `Deshacer`)

Devuelven `applied: AppliedAction` con el `undoSet` correspondiente. La UI muestra una tarjeta con `Deshacer` durante la sesión.

- `seguridad_close_street`, `seguridad_lift_closure`, `seguridad_remove_closure`
- `seguridad_create_perimeter` — **doble modo**:
  - **Polígono**: `area` textual → geocoding.
  - **Círculo**: `radiusMeters` + `centerLat/centerLng` o `centerRef='emergency'|VIC-XXX|AMB-XX`.
  - `color` opcional (paleta táctica `red/orange/yellow/green/teal/blue/purple/pink` o hex CSS).
- `seguridad_remove_perimeter`
- `seguridad_create_checkpoint` — acepta `lat/lng` directamente o `location` textual.
- `seguridad_remove_checkpoint`, `seguridad_set_access_state`
- `seguridad_register_incident` — incidencia de seguridad localizada. Requiere `title`; ubicación por `lat/lng`, `location` textual o `ref='emergency'|VIC-XXX|AMB-XX`. Severidad opcional (`critical|high|medium|low|info`, default `medium`).
- `sanitario_register_victim` — acepta `lat/lng` directamente o `location` textual.
- `sanitario_remove_victim`
- `sanitario_add_zone` — acepta `lat/lng` directamente o `location` textual.
- `sanitario_remove_zone`

### 12.2 Consciencia geoespacial del mapa (lectura)

- `map_get_emergency` — devuelve la emergencia activa con código, nombre, dominio, severidad, estado, momento de inicio, **origen lat/lng**, polígono de área afectada, población, descripción y puesto de mando.
- `map_list_points` — lista todo lo desplegado en el mapa con coordenadas e identificadores amigables. Filtrable por `categories`: `emergency, victims, ambulances, hospitals, sanitary_zones, perimeters, closures, checkpoints, command_posts, shelters, vehicles, field_reports`.
- `map_nearby` — entidades cercanas a un punto, ordenadas por distancia (default 500 m, configurable). Punto por `lat/lng` o por `ref` amigable (`emergency`, `VIC-XXX`, `AMB-XX`, indicativo de vehículo).

### 12.3 Operativas (se aplican directamente, sin tarjeta de deshacer)

**Seguridad** — `seguridad_register_evacuation`, `seguridad_list_closures`, `seguridad_list_perimeters`, `seguridad_list_checkpoints`, `seguridad_list_activities`.

**Sanitario** — `sanitario_update_triage`, `sanitario_set_victim_status`, `sanitario_assign_ambulance`, `sanitario_derive_to_hospital`, `sanitario_set_ambulance_state`, `sanitario_list_victims`, `sanitario_list_ambulances`, `sanitario_list_hospitals`, `sanitario_list_zones`, `sanitario_list_alerts`.

**Logística** — `logistica_create_supply`, `logistica_adjust_stock`, `logistica_create_request`, `logistica_decide_request`, `logistica_set_vehicle_state`, `logistica_set_service_status`, `logistica_list_supplies`, `logistica_critical_supplies`, `logistica_list_vehicles`, `logistica_list_machinery`, `logistica_list_services`, `logistica_list_requests`.

**Gabinete** — `gabinete_set_channel_status`, `gabinete_publish_communique`, `gabinete_retract_publication`, `gabinete_list_channels`, `gabinete_list_publications`.

**Dirección** — `direccion_set_level`, `direccion_activate`, `direccion_close`, `direccion_decide_media_request`, `direccion_set_communique_status`, `direccion_get_status`, `direccion_list_shelters`, `direccion_list_groups`, `direccion_list_communiques`, `direccion_list_media_requests`, `direccion_list_evacuations`, `direccion_list_command_posts`.

**Campo** — `campo_add_report`, `campo_request_support`, `campo_list_reports`, `campo_get_unit_status`.

### 12.4 Generales

- `goto_tab` — cambia la pestaña activa.
- `global_summary` — resumen multi-dominio del estado actual.
- `rag_query`, `rag_documentos_disponibles` — RAG.

### 12.5 Anatomía de un handler

Cada tool sigue el patrón:

```ts
{
  definition: {
    type: "function",
    function: {
      name: "seguridad_create_perimeter",
      description: "Crea un perímetro de seguridad. Dos modos: …",
      parameters: { /* JSON Schema con polígono O círculo */ },
    },
  },
  handler: async ({ label, kind, level, radiusMeters, centerRef, color, … }) => {
    // 1. resuelve color (paleta táctica o hex) y centro (lat/lng o ref)
    // 2. muta el store correspondiente (applyPerimeterCircle / applyPerimeterPolygon)
    // 3. devuelve { ok, message, applied: { kind, summary, detail, undo, appliedAt } }
    //    — el undoSet contiene los ids creados, listos para Deshacer
  },
}
```

`undoAppliedAction(applied)` se invoca desde la UI del chat cuando el operador pulsa **Deshacer**: recorre los `undo.{closures,perimeters,checkpoints,victims,sanitaryZones,incidents}` y elimina cada id de su store.

---

## 13. Hooks útiles

| Hook                    | Uso                                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| `useTacticalClock`      | Reloj operativo (UTC + local) con resolución de segundos.                 |
| `useFakeRealtime`       | Genera eventos sintéticos (movimientos, nuevas alertas) para demo.        |
| `useVoiceRecognition`   | Wrapper sobre `webkitSpeechRecognition` para reportes por voz en Campo y dictado en el chat de IA. |

Todos están re-exportados desde `hooks/index.ts`.

---

## 14. Convenciones de código

- **TypeScript estricto** (`tsconfig.app.json` + `noImplicitAny`).
- **ESLint** con reglas type-checked + `eslint-plugin-react-hooks` + `react-refresh`.
- **Stores Zustand**: una _slice_ por dominio; setters explícitos; selectors exportados; **nunca leas de otro store dentro de un setter**, recibe el dato como argumento.
- **Componentes**:
  - PascalCase, un componente por archivo.
  - Props tipadas con `interface` exportada si se reutilizan.
  - Estilos vía Chakra `sx` / props; evita `styled-components` mezclados.
- **Imports**: agrupa externos → internos absolutos por `src/` → relativos.
- **Comentarios**: en español, explican el _por qué_ (decisión de UX, restricción operativa). Evita comentarios narrativos del _qué_.
- **Mocks como única fuente** de datos iniciales — no mezcles _seed data_ dentro del store.
- **Tools del agente**: si la acción es de mapa, devuelve `applied` con `undoSet` completo. Si la acción es operativa pura, basta con `{ ok, message }`.
- **RAG**: nunca devuelvas información documental sin pasar por `rag_query`. Si el threshold no se supera tras el reintento, no respondas — rechaza explícitamente.

---

## 15. Scripts disponibles

```bash
yarn dev        # Vite dev server con HMR
yarn build      # type-check (tsc -b) + bundle de producción
yarn preview    # sirve el bundle generado en dist/
yarn lint       # ESLint sobre todo el proyecto
```

---

## 16. Limitaciones conocidas

- **API key en el bundle**: el proyecto es _frontend-only_; cualquier persona con acceso al navegador puede ver `VITE_OPENROUTER_API_KEY`. Antes de producción, introducir un proxy backend.
- **Sin backend**: todo el estado vive en memoria. Refrescar la página pierde el trabajo (los embeddings RAG sí persisten en IndexedDB; las mutaciones operativas no).
- **Ventana de _Deshacer_ por sesión**: la tarjeta con el botón _Deshacer_ vive mientras la sesión esté abierta. Si el operador refresca, las acciones aplicadas no se revierten — quedan en los stores pero la tarjeta desaparece. (Con persistencia de stores se podría reconstruir, pendiente.)
- **OCR no soportado**: PDFs escaneados sin capa de texto se rechazan en ingesta.
- **Sin búsqueda ANN**: válido hasta ~5K chunks. Si el corpus crece (varios planes municipales), sustituir vectorStore por HNSW/IVF o un backend dedicado.
- **Acciones operativas no se sincronizan**: cada sesión es local. No hay multi-operador en tiempo real.
- **Geocoding**: Nominatim es _rate-limited_ y no contractual. En producción sustituir por un servicio con SLA.
- **Sin tests automatizados**: el proyecto cubre flujos manualmente. No hay suite Jest/Vitest/Playwright.
- **WebSpeech**: `useVoiceRecognition` depende de `webkitSpeechRecognition` (Chrome/Edge). Firefox/Safari no soportados.
- **Sin _role-based access_**: todas las pestañas son visibles a cualquiera.

---

## 17. Roadmap

- [ ] Backend real (REST o WebSocket) detrás de la capa `services/`.
- [ ] Proxy server-side para OpenRouter (eliminar la API key del cliente).
- [ ] Persistencia de sesión (`zustand/middleware/persist`) para sobrevivir refrescos — incluyendo tarjetas de _Deshacer_ reconstruibles.
- [ ] _Replay_ del timeline + exportación a PDF post-emergencia.
- [ ] Tests E2E (Playwright) sobre los flujos de cada rol y _smoke tests_ del RAG.
- [ ] Modo _offline_ con cache de tiles del mapa.
- [ ] _Role-based access_ por pestaña.
- [ ] Búsqueda híbrida BM25 (sustituir el keyword overlap simple por scoring BM25 real cuando el corpus crezca).
- [ ] Mover transformers.js a un Web Worker para no bloquear la UI durante la ingesta.
- [ ] Soporte OCR (Tesseract.js) para PDFs escaneados.
- [ ] Multi-municipio: cargar dinámicamente distintos PLATERMU/PLATERCAM en sesiones diferenciadas.
- [ ] Tools de campo desde IA (`campo_*` más completas) para coordinar PMA y CECOPAL desde el mismo chat.

---

## 18. Licencia

Proyecto privado — uso interno. Contacta con el equipo de Osprean para cualquier consulta sobre derechos de uso o redistribución.
