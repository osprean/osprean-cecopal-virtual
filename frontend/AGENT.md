# Ops AI · Copiloto del Centro Operativo

> Documentación técnica profunda del **agente de IA** del Emergency Manager: arquitectura, ciclo de vida, catálogo de tools, sistema de auto-aplicación con deshacer, RAG _document-grounded_ y extensión.

Este documento es un acompañante del [README principal](./README.md). El README cubre la app entera; aquí se detalla **sólo** el agente y sus dependencias internas (`src/features/ai-ops/`).

---

## Tabla de contenidos

1. [Visión y alcance](#1-visión-y-alcance)
2. [Arquitectura del agente](#2-arquitectura-del-agente)
3. [Ciclo de vida de un turno](#3-ciclo-de-vida-de-un-turno)
4. [Estado: `aiOpsStore`](#4-estado-aiopsstore)
5. [Drawer (UI): `OpsAIDrawer`](#5-drawer-ui-opsaidrawer)
6. [System prompt y reglas innegociables](#6-system-prompt-y-reglas-innegociables)
7. [Catálogo de tools](#7-catálogo-de-tools)
8. [Auto-apply + Deshacer](#8-auto-apply--deshacer)
9. [Consciencia geoespacial del mapa](#9-consciencia-geoespacial-del-mapa)
10. [Perímetros (polígono vs círculo) y color](#10-perímetros-polígono-vs-círculo-y-color)
11. [Incidencias de seguridad desde IA](#11-incidencias-de-seguridad-desde-ia)
12. [Resolución de identificadores amigables](#12-resolución-de-identificadores-amigables)
13. [Pipeline RAG](#13-pipeline-rag)
14. [Determinismo, aborto y manejo de errores](#14-determinismo-aborto-y-manejo-de-errores)
15. [Servicios externos](#15-servicios-externos)
16. [Cómo extender el agente](#16-cómo-extender-el-agente)
17. [Anti-patrones y reglas de oro](#17-anti-patrones-y-reglas-de-oro)
18. [Troubleshooting](#18-troubleshooting)
19. [Limitaciones conocidas](#19-limitaciones-conocidas)

---

## 1. Visión y alcance

Ops AI es un **copiloto conversacional** integrado en el CECOP / PMA municipal. Su objetivo no es _explicar_ la app sino **operarla**: cortar calles, registrar víctimas, asignar ambulancias, levantar perímetros y citar el Plan Municipal con fidelidad literal.

Tiene **doble responsabilidad**:

| Responsabilidad | Mecanismo | Comportamiento |
| --------------- | --------- | -------------- |
| **Acciones operativas** sobre los stores Zustand | `function-calling` (OpenRouter) | Mismas acciones que el operador haría a mano. Las de mapa se **auto-aplican** y son **deshacibles** desde la tarjeta del chat. |
| **Consultas al Plan Municipal** (PLATERMU) y a PDFs subidos | RAG en navegador con rerank híbrido | Responde citando `chunk_id · sección · página`. Rechaza explícitamente si no hay evidencia suficiente. |

El agente **no genera código**, **no inventa procedimientos**, **no menciona el modelo subyacente**, **no usa la palabra "PROPUESTA"**. Habla como radio-operador: frases cortas, datos exactos, cero relleno.

---

## 2. Arquitectura del agente

Todo vive en `src/features/ai-ops/`:

```
ai-ops/
├── OpsAIButton.tsx     # Botón en TopNav (deshabilitado sin API key)
├── OpsAIDrawer.tsx     # Chat lateral · input · dictado · upload PDF · tarjetas
├── aiOpsStore.ts       # Zustand: mensajes, AppliedAction, undoSet, busy/error
├── orchestrator.ts     # Bucle function-calling (MAX_TURNS=6, abortable)
├── tools.ts            # ~65 tools: definition + handler + applyXxx + undoApplied
├── knowledge/
│   └── platermu.md     # Plan Municipal empaquetado (~1k líneas)
├── rag/
│   ├── ragService.ts       # ingest + query + rerank híbrido + formatDecisionForLLM
│   ├── embeddings.ts       # E5 multilingual-small en transformers.js
│   ├── vectorStore.ts      # IndexedDB + cosine exhaustivo
│   ├── chunker.ts          # semántico, respeta tablas/breadcrumbs
│   ├── markdownExtractor.ts
│   ├── pdfExtractor.ts     # pdfjs (sin OCR)
│   ├── seedPlatermu.ts     # idempotente al abrir el drawer
│   ├── RagStatusBar.tsx    # progreso ingesta
│   └── types.ts
└── index.ts
```

### Flujo de alto nivel

```
Usuario ──input──► OpsAIDrawer ──runChat()──► orchestrator
                                                     │
                                                     ▼
                                          OpenRouter (LLM, fetch)
                                                     │
                          ┌──────tool_calls?─────────┘
                          ▼ sí
                  executeTool(name, args)
                          │
              ┌───────────┼──────────────┐
              ▼           ▼              ▼
        stores Zustand  RAG service   geocoding (Nominatim)
              │           │              │
              ▼           ▼              ▼
        applyXxx() → AppliedAction       │
        con undoSet                      │
              │                          │
              └───────► result al LLM ◄──┘
                          │
                          ▼ (MAX_TURNS hasta respuesta final)
                  Mensaje assistant ──► OpsAIDrawer (tarjetas, Deshacer)
```

---

## 3. Ciclo de vida de un turno

`orchestrator.ts` implementa el bucle clásico de _function-calling_ de OpenAI/OpenRouter. El máximo de iteraciones es `MAX_TURNS = 6`.

```ts
for (let turn = 0; turn < MAX_TURNS; turn++) {
  const messages = buildLlmMessages();          // system + historial + tool_results
  const response = await chatCompleteRaw(messages, {
    tools: TOOL_DEFINITIONS,
    toolChoice: "auto",
    temperature: 0,
    topP: 0,
    signal: opts.signal,
  });

  // 1. Siempre creamos un assistant message para esta vuelta.
  const assistantId = store.pushMessage({ role: "assistant", content: response.content ?? "" });

  // 2. Si hay tool_calls, las ejecutamos secuencialmente y volvemos a llamar al LLM.
  if (response.tool_calls?.length) {
    store.attachToolCalls(assistantId, response.tool_calls);
    for (const call of response.tool_calls) {
      const result = await executeTool(call.function.name, JSON.parse(call.function.arguments));
      store.setToolResult(assistantId, call.id, { ok: result.ok, message: result.message }, result.applied);
    }
    continue;            // siguiente vuelta: el modelo redacta la respuesta final
  }
  return;                // sin tool_calls → fin
}
store.setError("Demasiadas iteraciones — bucle interrumpido.");
```

### Detalles importantes

- **Tools secuenciales** dentro de un turno. No se paralelizan: el orden importa para `goto_tab → map_get_emergency → seguridad_create_perimeter`.
- **Historial reconstruido por turno**: incluimos `tool_results` previos para que el modelo "vea" todo lo ejecutado y pueda redactar la respuesta final.
- **Determinismo**: `temperature=0`, `top_p=0`. Mismas entradas → mismas tools en el mismo orden → misma respuesta.
- **Anti-bucle**: cap de 6 vueltas. En la práctica, un turno normal usa 2 vueltas (tool_call → respuesta), uno con RAG y reintento usa 3–4.

---

## 4. Estado: `aiOpsStore`

Zustand store con todo el historial conversacional y el estado de las acciones aplicadas. Tipos clave:

```ts
type AppliedActionKind =
  | "close_street"
  | "create_perimeter"
  | "create_checkpoint"
  | "register_victim"
  | "add_zone"
  | "register_incident";

interface AppliedUndoSet {
  closures?: string[];
  perimeters?: string[];
  accessControls?: string[];
  victims?: string[];
  sanitaryZones?: string[];
  incidents?: string[];
}

interface AppliedAction {
  kind: AppliedActionKind;
  summary: string;     // "Cortada Calle Mayor"
  detail?: string;     // "Madrid Centro · Motivo: incendio"
  undo: AppliedUndoSet;
  appliedAt: string;   // ISO
  undone?: boolean;
}

interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: { ok: boolean; message: string };
  applied?: AppliedAction;
  status?: "applied" | "undone";
}

interface OpsChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCallRecord[];
  timestamp: string;
}
```

Estado a nivel store:

```ts
{
  open: boolean;          // drawer visible
  busy: boolean;          // hay turno en curso
  messages: OpsChatMessage[];
  error: string | null;   // último error, mostrado en banner
}
```

API mínima: `setOpen`, `setBusy`, `setError`, `pushMessage`, `attachToolCalls`, `setToolResult`, `updateToolCall`, `clear`.

---

## 5. Drawer (UI): `OpsAIDrawer`

Componente lateral persistente que orquesta toda la interacción visible.

### Capacidades

| Capacidad | Cómo |
| --------- | ---- |
| Mensajes con tarjetas de acción | Cada `ToolCallRecord` con `applied` se renderiza como tarjeta con `summary`, `detail` y botón **Deshacer**. |
| **Dictado por voz** | `useSpeechDictation` (wrapper de `webkitSpeechRecognition`). Botón de micro en el input — solo Chrome/Edge. |
| **Adjuntar PDF** | Input `accept=".pdf"` oculto; al elegir archivo se llama `ingestPdfFile()`. La barra de estado de RAG informa del progreso. |
| **Bloqueo durante ingesta** | Mientras `ingestStatus.phase ∈ {extracting,chunking,embedding,indexing}` el input se deshabilita: evita responder con índice incompleto. |
| **Detener generación** | Botón _Stop_ → dispara `AbortController.abort()`. El orquestador detecta `aborted` y sale sin escribir mensajes de error. |
| **Autosize del textarea** | `useLayoutEffect` recalcula altura entre 40 y 180 px. |
| **Auto-scroll al final** | Se ancla al fondo en cada cambio de `messages` o `busy`. |
| **Avatar IA** | `/osprean.png` (logo de marca). |
| **`RagStatusBar`** | Barra superior con el progreso de ingesta y errores de RAG. |

### Suscripción a progreso RAG

```ts
useEffect(() => onIngestProgress(setIngestStatus), []);
```

`onIngestProgress` es un pub/sub minimal en `ragService.ts`; emite el estado actual al suscribir.

---

## 6. System prompt y reglas innegociables

El prompt vive como string en `orchestrator.ts`. Calibrado para español, tono de radio-operador. Bloques principales:

### 6.1 Tono

- Frases cortas, sin saludos ni "por supuesto", "permíteme", "voy a".
- **Prohibido** mencionar "función", "herramienta", "sistema".
- **No** repetir la petición del usuario.

### 6.2 RAG estricto

- Cualquier pregunta sobre el Plan Municipal → SIEMPRE `rag_query`. Nada de memoria del modelo.
- Decisiones según `RAG_STATUS`:
  - `ok` → sintetiza usando **solo** el texto literal; respeta números, calles, teléfonos sin redondear; enumera TODO lo relevante (no resume saltando ítems).
  - `empty` → "El Plan Municipal todavía no está disponible. Espera unos segundos a que termine de cargarse o solicita al operador que lo cargue."
  - `no-hits` / `below-threshold` → **reintento obligatorio**: reformula la consulta con vocabulario del Plan (`"fuga de gas"` → `"protocolo Naturgy GLP fuga"`, `"cuándo se evacúa"` → `"fase situación 2 evacuación"`). Si el segundo intento también falla: _"La información no está disponible en el Plan Municipal proporcionado."_
- Si fragmentos del mismo `RAG_STATUS=ok` se contradicen, **lo dice y cita ambos**.
- **Formato obligatorio** en respuestas al Plan:

  ```
  Respuesta:
  <síntesis directa>

  Fuente:
  - <chunk_id> · <breadcrumb> · página <N>
  ```

### 6.3 Acciones sobre la sala

- **Mapa** (cierres, perímetros, checkpoints, víctimas, zonas, incidencias): **auto-aplicación inmediata**, sin "PROPUESTA", sin pedir confirmación. Tras ejecutar: una sola frase corta ("Cortada Calle Mayor", "Perímetro creado en el sector norte"). Si el operador quiere revertir, se recurre al botón _Deshacer_ de la tarjeta o a la tool inversa (`seguridad_remove_*`, `sanitario_remove_*`).
- **Operativas puras** (asignar, derivar, cambiar estado): se aplican y se confirman con una frase corta.
- **Datos faltantes**: pedir SOLO el dato esencial en una pregunta corta — un dato por turno, sin encadenar preguntas.
- **Errores** (`ok=false`): explicar motivo en una frase y sugerir corrección.

### 6.4 Consciencia geoespacial

- `map_get_emergency` → coordenadas reales de la emergencia activa.
- `map_list_points` → todo lo desplegado en el mapa.
- `map_nearby` → entidades cerca de un punto/ref.
- Para crear cosas relativas al mapa: **primero** obtener coordenadas con `map_*`, **después** llamar a la tool de creación con `lat/lng`. Nunca pasar `location` y `lat/lng` a la vez.

### 6.5 Perímetros circulares vs polígonos

- "radio", "X metros alrededor de…", "círculo de seguridad" → modo **círculo** con `radiusMeters` + `centerRef='emergency'|VIC-XXX|AMB-XX` o `centerLat/centerLng`.
- "alrededor del barrio Y", "zona del polígono industrial" → modo **polígono** con `area` (texto que se geocodifica).

### 6.6 Color de perímetro

- Si el operador pide un color ("píntalo rojo", "naranja", "`#FF8800`"), pasar `color` con nombre de la paleta (`red, orange, yellow, green, teal, blue, purple, pink`) o hex CSS.
- Si no menciona, no pasarlo → cada `kind` tiene su default (exclusion=rojo, evacuation=naranja, safety=amarillo, buffer=azul).

### 6.7 Incidencias de seguridad

- Requieren `title` + ubicación. Si falta uno, preguntar **solo** por ese — nunca encadenar.
- Severidad es opcional con default `medium`. No preguntar salvo que el operador exprese duda explícita.

### 6.8 Identificadores

- Víctimas → código (`VIC-003`).
- Ambulancias / vehículos → indicativo (`AMB-04`, `CAR-12`).
- Calles → nombre.
- Hospitales → nombre.
- **Nunca** inventar IDs internos (`incident-1A2B…`).

### 6.9 Borrar vs reabrir

- "borrar", "quitar", "eliminar" → `*_remove_*` (eliminación total).
- "reabrir", "levantar", "anular" un cierre → `seguridad_lift_closure` (queda como histórico).

---

## 7. Catálogo de tools

`tools.ts` exporta `TOOLS: Tool[]` y `TOOL_DEFINITIONS` (los JSON Schemas que se mandan al LLM). Cada `Tool` es:

```ts
interface Tool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
  applied?: AppliedAction;   // solo en tools de mapa auto-aplicables
}
```

### 7.1 Categorías

| Categoría | Patrón | Ejemplos |
| --------- | ------ | -------- |
| **Mapa (auto-apply + undo)** | Devuelven `applied` con `undoSet` | `seguridad_close_street`, `seguridad_create_perimeter`, `seguridad_create_checkpoint`, `seguridad_register_incident`, `sanitario_register_victim`, `sanitario_add_zone` |
| **Mapa (limpieza)** | Eliminan IDs específicos sin undo (la acción ya es destructiva) | `seguridad_remove_closure`, `seguridad_remove_perimeter`, `seguridad_remove_checkpoint`, `sanitario_remove_victim`, `sanitario_remove_zone` |
| **Mapa (modificación de estado)** | Cambian un campo sin crear ni borrar | `seguridad_lift_closure`, `seguridad_set_access_state`, `sanitario_update_triage`, `sanitario_set_ambulance_state` |
| **Operativas puras** | Mutan stores, no tocan mapa, no requieren undo | `sanitario_assign_ambulance`, `sanitario_derive_to_hospital`, `logistica_adjust_stock`, `gabinete_publish_communique`, `direccion_set_level` |
| **Listados / lectura de sala** | Solo leen state; devuelven datos para que el LLM redacte | `*_list_*`, `logistica_critical_supplies`, `direccion_get_status`, `campo_get_unit_status` |
| **Consciencia geoespacial** | Lectura del estado del mapa | `map_get_emergency`, `map_list_points`, `map_nearby` |
| **Globales** | Lectura multi-dominio o navegación | `goto_tab`, `global_summary` |
| **RAG** | Consulta documental | `rag_query`, `rag_documentos_disponibles` |

### 7.2 Lista completa

**Seguridad**: `seguridad_close_street`, `seguridad_lift_closure`, `seguridad_remove_closure`, `seguridad_create_perimeter`, `seguridad_remove_perimeter`, `seguridad_create_checkpoint`, `seguridad_remove_checkpoint`, `seguridad_set_access_state`, `seguridad_register_evacuation`, `seguridad_register_incident`, `seguridad_list_closures`, `seguridad_list_perimeters`, `seguridad_list_checkpoints`, `seguridad_list_activities`.

**Sanitario**: `sanitario_register_victim`, `sanitario_remove_victim`, `sanitario_add_zone`, `sanitario_remove_zone`, `sanitario_update_triage`, `sanitario_set_victim_status`, `sanitario_assign_ambulance`, `sanitario_derive_to_hospital`, `sanitario_set_ambulance_state`, `sanitario_list_victims`, `sanitario_list_ambulances`, `sanitario_list_hospitals`, `sanitario_list_zones`, `sanitario_list_alerts`.

**Logística**: `logistica_create_supply`, `logistica_adjust_stock`, `logistica_create_request`, `logistica_decide_request`, `logistica_set_vehicle_state`, `logistica_set_service_status`, `logistica_list_supplies`, `logistica_critical_supplies`, `logistica_list_vehicles`, `logistica_list_machinery`, `logistica_list_services`, `logistica_list_requests`.

**Gabinete**: `gabinete_set_channel_status`, `gabinete_publish_communique`, `gabinete_retract_publication`, `gabinete_list_channels`, `gabinete_list_publications`.

**Dirección**: `direccion_set_level`, `direccion_activate`, `direccion_close`, `direccion_decide_media_request`, `direccion_set_communique_status`, `direccion_get_status`, `direccion_list_shelters`, `direccion_list_groups`, `direccion_list_communiques`, `direccion_list_media_requests`, `direccion_list_evacuations`, `direccion_list_command_posts`.

**Campo**: `campo_add_report`, `campo_request_support`, `campo_list_reports`, `campo_get_unit_status`.

**Mapa / globales / RAG**: `map_get_emergency`, `map_list_points`, `map_nearby`, `goto_tab`, `global_summary`, `rag_query`, `rag_documentos_disponibles`.

---

## 8. Auto-apply + Deshacer

Es el patrón central de las tools de mapa. Sustituye al flujo previo de _pending action_ con doble confirmación.

### 8.1 El patrón aplicador

Cada acción de mapa tiene un **aplicador** asincrónico (`applyCloseStreet`, `applyPerimeterPolygon`, `applyPerimeterCircle`, `applyCheckpoint`, `applyVictim`, `applyIncident`, `applyZone`). Todos siguen la misma secuencia:

1. **Cambiar a la tab relevante** (`useTabsStore.setActiveTab`).
2. **`flyTo`** sobre el punto/bounds (`useMapFlyStore.flyToPoint` o `flyToBounds`).
3. **`setMode`** en el store de la página correspondiente (mostrar overlay de dibujo).
4. **Pausa visual** (`sleep(1300–1500)`) para que la cámara se asiente y el operador vea qué va a pasar.
5. **Inyectar puntos** de dibujo (`addDrawingPoint`, `setPendingPoint`, `setCircleCenter`/`setCircleRadius`).
6. **Snapshot `before`** de la lista del store antes de crear.
7. **Crear la entidad** (`createClosure`, `createPerimeter`, `createAccessControl`, `registerVictim`, `addZone`, `registerIncident`).
8. **Diff de ids** entre `before` y `after` → `AppliedUndoSet`.

```ts
const diffIds = <T extends { id: string }>(before: T[], after: T[]): string[] => {
  const seen = new Set(before.map((x) => x.id));
  return after.filter((x) => !seen.has(x.id)).map((x) => x.id);
};
```

Captura **exactamente** lo que la acción creó, sin acoplar las funciones del store al saber sus ids generados.

### 8.2 `undoAppliedAction`

Definida al final de `tools.ts`. Recibe el `AppliedAction` y recorre el `undoSet` eliminando cada id de su store:

```ts
export const undoAppliedAction = (action: AppliedAction): { ok; message } => {
  const seg = useSeguridadStore.getState();
  const san = useSanitarioStore.getState();
  let removed = 0;
  action.undo.closures?.forEach((id) => { seg.removeClosure(id); removed++; });
  action.undo.perimeters?.forEach((id) => { seg.removePerimeter(id); removed++; });
  action.undo.accessControls?.forEach((id) => { seg.removeAccessControl(id); removed++; });
  action.undo.victims?.forEach((id) => { san.removeVictim(id); removed++; });
  action.undo.sanitaryZones?.forEach((id) => { san.removeZone(id); removed++; });
  action.undo.incidents?.forEach((id) => { useIncidentsStore.getState().removeIncident(id); removed++; });
  return removed
    ? { ok: true, message: `Deshecho: ${action.summary}.` }
    : { ok: false, message: "Nada que deshacer (ya no existe en el mapa)." };
};
```

La tarjeta del chat invoca esta función al pulsar **Deshacer** y actualiza el `status` del `ToolCallRecord` a `"undone"`. El botón desaparece tras la primera invocación.

### 8.3 Por qué este patrón (en lugar de doble confirmación)

- **Velocidad operativa**: en una emergencia el operador no quiere "Confirmar / Cancelar" para cada acción.
- **Feedback visible**: el `flyTo` + `setMode` + dibujo hace que el operador **vea** lo que el agente está haciendo en tiempo real.
- **Reversibilidad granular**: deshacer afecta SOLO a lo creado por esa acción, sin tocar cosas que el operador hubiera puesto a mano entremedias.
- **Idempotente al fallar**: si la pausa visual o el `flyTo` fallan, la entidad ya está en el store; el undo sigue funcionando.

---

## 9. Consciencia geoespacial del mapa

Tres tools de lectura permiten al agente "ver" el mapa antes de actuar.

### 9.1 `map_get_emergency`

Sin parámetros. Devuelve la emergencia activa:

```ts
{
  id, code, name, domain, severity, status, startedAt,
  origin: { lat, lng },     // ← coordenadas reales del foco
  area,                     // polígono del área afectada
  affectedPopulation,
  description,
  commandPost,
}
```

Uso típico: el operador dice "perímetro de 200 m alrededor del origen" → el agente llama `map_get_emergency`, extrae `origin`, llama `seguridad_create_perimeter` en modo círculo con esos `centerLat/centerLng`.

### 9.2 `map_list_points`

Filtrable por `categories`. Devuelve lista completa por categoría con coordenadas e identificador amigable:

```ts
{
  emergency: { code, name, lat, lng },
  victims: [{ code, triage, status, lat, lng }, …],
  ambulances: [{ callSign, kind, state, lat, lng }, …],
  hospitals: [{ name, level, state, lat, lng }, …],
  sanitary_zones: [{ label, kind, state, lat, lng }, …],
  perimeters: [{ label, kind, level, status, lat, lng }, …],   // centro
  closures: [{ road, km, status, lat, lng }, …],
  checkpoints: [{ label, kind, state, lat, lng }, …],
  command_posts: [{ code, type, state, lat, lng }, …],
  shelters: [{ name, capacity, occupancy, state, lat, lng }, …],
  vehicles: [{ callSign, kind, state, lat, lng }, …],
  field_reports: [{ id, kind, title, lat, lng }, …],
}
```

Uso: "qué tengo desplegado" / antes de buscar una entidad por nombre, para no inventar IDs.

### 9.3 `map_nearby`

Punto de referencia por `lat/lng` o `ref` amigable (`'emergency'`, `VIC-XXX`, `AMB-XX`, callsign de vehículo). Radio configurable (default 500 m). Devuelve hasta 20 items ordenados por distancia haversine:

```ts
{
  origin: { lat, lng },
  radiusMeters: 500,
  items: [
    { category: "victim", label: "VIC-003 (red)", lat, lng, meters: 87 },
    { category: "ambulance", label: "AMB-04 (en-ruta)", lat, lng, meters: 152 },
    ...
  ],
}
```

Distancia con haversine simplificada (`dist(a, b)` en `tools.ts`). Suficiente para distancias urbanas <10 km.

---

## 10. Perímetros (polígono vs círculo) y color

`seguridad_create_perimeter` tiene dos modos disjuntos. La heurística para decidir es:

```ts
const wantCircle =
  typeof radiusMeters === "number" &&
  (typeof centerLat === "number" || typeof centerLng === "number" || centerRef);
```

### 10.1 Modo polígono

- Parámetro `area`: texto que se manda a **Nominatim** (`geocodeForPolygon`).
- Si Nominatim devuelve una geometría tipo `Polygon` / `MultiPolygon`, se extrae el anillo exterior y se simplifica a 12 puntos equiespaciados (`simplifyAlong`).
- Si solo hay `boundingBox`, se construye un polígono rectangular.
- Si el bbox es minúsculo (calle puntual), se expande +0.002° en cada eje para que el polígono sea visible.
- Pintado vía `applyPerimeterPolygon` con `addDrawingPoint(pt)` punto por punto (con sleep 180 ms cada uno → animación de dibujo).

### 10.2 Modo círculo

- Centro resuelto de tres formas:
  1. `centerLat` + `centerLng` directos.
  2. `centerRef='emergency'` → `selectActiveEmergency().location`.
  3. `centerRef='VIC-XXX'` o `'AMB-XX'` → busca en sanitarioStore.
- `radiusMeters` obligatorio y positivo.
- Pintado vía `applyPerimeterCircle` con `setCircleCenter` + `setCircleRadius` (modo `perimeter` + `setPerimeterShape("circle")`).

### 10.3 Color

```ts
const resolveColor = (input?: unknown): string | undefined => {
  if (input == null) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)) return s;
  const named = PERIMETER_PALETTE.find((p) => p.name === s.toLowerCase());
  return named?.hex;
};
```

- Acepta hex CSS (`#FF8800`, `#F80`).
- Acepta nombres de la paleta táctica: `red, orange, yellow, green, teal, blue, purple, pink`.
- Si no es válido o no se pasa: `undefined` → el perímetro usa el color por defecto de su `kind` (definido en `seguridadStore`).

---

## 11. Incidencias de seguridad desde IA

`seguridad_register_incident` permite al agente reportar incidencias localizadas (persona perdida, conato, robo, vehículo abandonado…) directamente sobre el mapa. Es funcionalmente idéntico a crear una incidencia desde la `SeguridadActionToolbar`.

### 11.1 Parámetros

| Campo | Tipo | Obligatorio | Notas |
| ----- | ---- | ----------- | ----- |
| `title` | string | sí | Título corto ("Persona perdida en parque"). |
| `notes` | string | no | Detalles. |
| `severity` | enum `critical\|high\|medium\|low\|info` | no | Default `medium`. |
| `lat` + `lng` | number | uno de los tres | Coordenadas directas. |
| `location` | string | uno de los tres | Texto → geocoding. |
| `ref` | string | uno de los tres | `'emergency'`, `VIC-XXX`, `AMB-XX`. |

### 11.2 Flujo

1. Validar `title`. Si vacío → `ok: false`.
2. Resolver el punto en orden: `lat/lng` → `ref` → `location` (geocoding).
3. Si nada resuelve → mensaje de error pidiendo lat/lng o ref.
4. Normalizar `severity` (default `medium`).
5. `applyIncident({ title, notes, severity, point })`:
   - `goto_tab("seguridad")`, `flyTo`, `setMode("incident")`, `setPendingPoint`.
   - `registerIncident({ title, notes })` (el store usa `medium` por defecto).
   - Si la severidad pedida no es `medium`, **se parchea** el incidente tras crearlo (`upsertIncident({...inc, severity})`).
   - Diff de ids del `incidentsStore` → `undoSet.incidents`.
6. Devolver `AppliedAction` con `kind: "register_incident"`.

### 11.3 Capa de render

La capa `SeguridadMapLayers` filtra los incidentes del `incidentsStore` por `domain === "security"` y los pinta con un icono distintivo. Las incidencias creadas por la IA y las creadas a mano viven en el mismo store → se ven en el mismo overlay.

---

## 12. Resolución de identificadores amigables

El LLM nunca pasa IDs internos. Los handlers resuelven por identificador amigable usando helpers privados de `tools.ts`:

| Helper | Busca en | Match |
| ------ | -------- | ----- |
| `findVehicleByCallSign(cs)` | `logisticaStore.vehicles` | callsign exacto (case-insensitive). |
| `findAmbulanceByCallSign(cs)` | `sanitarioStore.ambulances` | callsign exacto. |
| `findVictimByCode(code)` | `sanitarioStore.victims` | code exacto. |
| `findHospitalByName(name)` | `sanitarioStore.hospitals` | substring. |
| `findClosureByRoad(road)` | `seguridadStore.closures` | exacto → substring fallback. |
| `findSupplyByName(name)` | `logisticaStore.supplies` | substring. |
| `findRequestByItem(ref)` | `logisticaStore.requests` | substring de `itemName` o id exacto. |
| `findServiceByKindArea(kind, area?)` | `logisticaStore.services` | kind exacto + substring de área. |
| `findChannelByName(name)` | `gabineteStore.channels` | id → kind → alias (mapa `CHANNEL_ALIASES`). |
| `findCommuniqueByTitle(title)` | `direccionStore.communiques` | substring de title o id exacto. |
| `findMediaRequestByRef(ref)` | `direccionStore.mediaRequests` | id, requestedBy, reason o resourceType (substring). |

`CHANNEL_ALIASES` es un mapa explícito para que palabras coloquiales encuentren el canal correcto:

```ts
{
  press:            ["press", "prensa", "rueda de prensa"],
  "social-x":       ["x", "twitter", "tuiter"],
  "social-instagram":["instagram", "ig", "insta"],
  "social-facebook":["facebook", "fb"],
  "es-alert":       ["es-alert", "esalert", "alerta", "es alert"],
  rne:              ["rne", "radio nacional"],
}
```

---

## 13. Pipeline RAG

El módulo `rag/` es independiente del agente: cualquier cliente podría usarlo. El agente lo invoca a través de dos tools:

- **`rag_query(consulta)`** → `RagDecision` + bloque formateado para el LLM con `formatDecisionForLLM`.
- **`rag_documentos_disponibles()`** → lista corta (`title · chunks · source`).

### 13.1 Etapas

```
extracción → chunking → embedding → indexado → query+rerank híbrido
 (MD/PDF)    (semántico)  (E5 384d)  (IDB)      (cosine + keyword)
```

| Fase | Archivo | Notas clave |
| ---- | ------- | ----------- |
| Extracción Markdown | `markdownExtractor.ts` | Convención `<!-- SECTION:clave -->` para simular paginación. |
| Extracción PDF | `pdfExtractor.ts` | `pdfjs-dist`. Agrupa items en líneas, detecta tablas por gaps X, headings por tamaño de fuente. **Sin OCR**. |
| Chunking | `chunker.ts` | 300–800 tokens ideal, 1200 hard-max. Tablas y listas indivisibles. No cruza headings nivel ≤2. Preserva breadcrumb. |
| Embedding | `embeddings.ts` | `Xenova/multilingual-e5-small` cuantizado (~120 MB). Prefijos `query:` / `passage:` obligatorios. L2 normalizado. |
| Vector store | `vectorStore.ts` | IndexedDB via `idb`. Cosine exhaustiva. Versionado por `embeddingModel` (cambiar modelo purga). |
| Query | `ragService.ts` | Rerank híbrido + threshold + topK. |

### 13.2 Rerank híbrido

El score final que se compara con el threshold es:

```
score = 0.7 · cosine + 0.3 · keyword_overlap_ratio
```

- `keyword_overlap_ratio`: ratio [0,1] de tokens de la consulta presentes literalmente en el chunk (cobertura, no frecuencia).
- Tokenización (`extractQueryTokens`):
  - Acrónimos en mayúsculas preservados ANTES de normalizar a lowercase (CECOPAL, GLP, SEVESO, PMA).
  - Tokens alfanuméricos ≥3 chars que no sean stopwords.
  - Números de ≥2 dígitos siempre (teléfonos, códigos postales).
- Stopwords: lista mínima en español, sin tecnicismos cortos.
- **Pool de candidatos**: `4 × topK` antes del rerank → permite rescatar chunks con keyword strong pero coseno bajo.

### 13.3 Parámetros

```ts
RAG_THRESHOLD       = 0.35   // sobre score híbrido (≈ 0.45 sobre coseno puro)
RAG_TOPK            = 8      // antes 5; preguntas amplias necesitan más contexto
RAG_COSINE_WEIGHT   = 0.7
RAG_KEYWORD_WEIGHT  = 0.3
RAG_CANDIDATE_FACTOR= 4      // pool = 4*topK
```

### 13.4 Decisiones

```ts
type RagDecision =
  | { ok: true; hits: RetrievalHit[] }
  | { ok: false; reason: "no-hits" | "below-threshold" | "empty-index"; best?: RetrievalHit };
```

`formatDecisionForLLM` lo serializa para el modelo:

- `ok` → `RAG_STATUS=ok` + bloques `--- FRAGMENTO ---` con `chunk_id`, `documento`, `seccion`, `pageRef`, `tipo`, `score`, texto literal.
- `empty-index` → `RAG_STATUS=empty` + instrucción explícita.
- `below-threshold` → `RAG_STATUS=below-threshold` con score máximo encontrado y la respuesta literal a usar.
- `no-hits` → `RAG_STATUS=no-hits` con la respuesta literal a usar.

### 13.5 Ingesta

- **PLATERMU** (`seedPlatermu.ts`): se llama al abrir el drawer la primera vez. **Idempotente**: si ya está indexado con el modelo actual, no hace nada.
- **PDFs subidos** (`ingestPdfFile`): `docId = pdf-<slug>-<hash4>`. Reutiliza el resto del pipeline. Si el PDF es escaneado (sin capa de texto), `extractPdf` devuelve bloques vacíos → ingesta rechazada con mensaje claro.

### 13.6 Pub/sub de progreso

`ragService` mantiene una lista de listeners y un `current` con el último estado:

```ts
onIngestProgress(cb)          // suscribe + emite estado actual
getIngestStatus(): IngestProgress
```

`OpsAIDrawer` y `RagStatusBar` se suscriben para mostrar progreso y bloquear el input durante la ingesta.

---

## 14. Determinismo, aborto y manejo de errores

### 14.1 Determinismo

- `temperature=0`, `top_p=0` en cada llamada a OpenRouter.
- Razón: en modo _document-grounded_ no queremos _sampling_. En acciones operativas, mismas entradas → misma asignación (reproducibilidad para auditoría).

### 14.2 Aborto

- `runChat(text, { signal })` acepta `AbortSignal`.
- El drawer crea un `AbortController` por turno (`abortRef`); el botón _Detener_ llama `abort()`.
- El orquestador detecta `aborted` por tres vías (signal, `DOMException AbortError`, regex sobre el mensaje) y sale **sin** escribir mensaje de error en pantalla.

### 14.3 Errores

- Si una tool tira excepción → se captura en `executeTool` y devuelve `{ ok: false, message }`. El LLM la ve y reformula.
- Si la llamada al LLM falla (red, 4xx/5xx, abort no voluntario) → `store.setError(msg)` + mensaje conversacional: _"No he podido completar la petición. Inténtalo de nuevo."_ (sin tono técnico, sin icono de error).
- Si `MAX_TURNS = 6` se agota → `store.setError("Demasiadas iteraciones — bucle interrumpido.")`. Salvaguarda anti-bucle.

---

## 15. Servicios externos

### 15.1 OpenRouter (`services/openrouter.ts`)

Cliente `fetch` minimal sobre `https://openrouter.ai/api/v1/chat/completions`. API key vía `VITE_OPENROUTER_API_KEY`. Modelo vía `VITE_OPENROUTER_MODEL` (default `anthropic/claude-3.5-haiku`).

> ⚠️ La key viaja en el bundle. Para producción, introducir un proxy backend que firme las llamadas.

### 15.2 Nominatim (`services/geocoding.ts`)

- `forwardGeocode(query)` con `polygon_geojson=1` para conseguir geometría real.
- Helpers internos en `tools.ts`:
  - `geocodeForSegment(road)` → extrae la polilínea más larga (`extractLongestLine`) y toma los puntos al 10% y 90% del recorrido (segmento "honesto" sobre el vial real, no la diagonal del bbox).
  - `geocodeForPolygon(area)` → anillo exterior del polígono más grande (`extractOuterRing`) simplificado a 12 puntos.
  - `geocodeForPoint(location)` → primer resultado.
- Fallback en cada caso a `boundingBox`, y en último recurso a expansión `±0.0006°` alrededor del punto.

### 15.3 Transformers.js (embeddings)

`@xenova/transformers` ejecuta el modelo E5 en el navegador vía ONNX/WASM. Primera descarga ~120 MB cuantizados → cacheados en IndexedDB. Singleton.

---

## 16. Cómo extender el agente

### 16.1 Añadir una tool nueva

1. Decide la categoría: **operativa pura**, **lectura**, **mapa con undo**, o **RAG**.
2. Añade un objeto al array `TOOLS` en `tools.ts`:

   ```ts
   {
     definition: {
       type: "function",
       function: {
         name: "mi_dominio_mi_accion",
         description: "Frase imperativa. Indica al LLM CUÁNDO usar esta tool, no QUÉ hace internamente.",
         parameters: { type: "object", properties: { … }, required: [...] },
       },
     },
     handler: async ({ x, y }) => {
       const entity = findXByCode(String(x));
       if (!entity) return { ok: false, message: `No se encontró "${x}".` };
       useMiStore.getState().mutate(entity.id, { … });
       return { ok: true, message: `Mutación aplicada a ${entity.code}.` };
     },
   }
   ```
3. Si es una **acción de mapa auto-aplicable**:
   - Crea un `applyXxx()` siguiendo el patrón: `setActiveTab → flyTo → setMode → sleep → addDrawingPoint → snapshot before → create* → diffIds → return undoSet`.
   - Devuelve `applied: AppliedAction` en el handler.
   - Si el `undoSet` toca un store nuevo, añade el `removeXxx` en `undoAppliedAction`.
   - Si el `AppliedActionKind` es nuevo, añádelo al union en `aiOpsStore.ts`.
4. Actualiza el system prompt **solo si la tool tiene heurísticas no obvias**:
   - Cuándo preferirla frente a otras similares.
   - Datos obligatorios que pueden faltar (y cómo preguntarlos).
   - Identificadores amigables que acepta.

### 16.2 Añadir un nuevo tipo de identificador amigable

- Añade el `findXxxByYyy()` siguiendo el patrón de los existentes (case-insensitive, exacto → substring si aplica).
- Si tiene alias coloquiales, añade un mapa estilo `CHANNEL_ALIASES` y úsalo en el resolutor.

### 16.3 Cambiar el modelo LLM

- Cambia `VITE_OPENROUTER_MODEL` en `.env.local`.
- Si el modelo no soporta `function-calling` con `tool_choice: "auto"` → no servirá. Verifica antes en OpenRouter.
- Si el modelo soporta _structured outputs_ pero con sintaxis distinta, hay que ajustar `services/openrouter.ts` (puede que el wrapper actual no baste).

### 16.4 Cambiar el modelo de embeddings RAG

- Cambia el id en `embeddings.ts`.
- El vector store está **versionado por modelo**: al cambiarlo, los chunks anteriores se descartan en la siguiente lectura.
- Re-ingesta automática del PLATERMU al abrir el drawer (es idempotente).

---

## 17. Anti-patrones y reglas de oro

### Para el código

- **No** leer un store dentro del setter de otro store.
- **No** confiar en que el `createXxx` del store devuelve el id — usa `diffIds(before, after)` siempre.
- **No** añadir comentarios narrativos en handlers. El JSON Schema y el nombre del handler ya cuentan _qué_ hace. Si necesitas explicar _por qué_ una decisión (umbral, alias, fallback), entonces sí.
- **No** mezclar geocoding y `lat/lng` en un mismo handler — si llega `lat`+`lng` úsalos directamente; si no, intenta `ref`; si no, `location` con geocoding. Devuelve error claro si nada resuelve.
- **No** acoplar el agente a entornos de prueba: el agente lee state real de los stores y no debe asumir mocks.

### Para el system prompt

- **No** describirle al modelo las implementaciones internas. Solo cuándo usar qué tool y cómo formatear la respuesta.
- **No** añadir reglas que el modelo va a ignorar por contradicción. Calibrar con el tono de las reglas existentes.
- **No** confiar en el modelo para "deducir" datos esenciales — pedir UN dato por turno explícitamente.

### Para RAG

- **Nunca** responder al usuario con conocimiento del modelo. Si el bloque RAG_STATUS no es `ok`, el modelo debe rechazar.
- **Nunca** rebajar el threshold _ad hoc_ desde una tool. Si una pregunta legítima cae sistemáticamente bajo el umbral, mejora el documento o el chunker, no el threshold.

---

## 18. Troubleshooting

| Síntoma | Causa probable | Cómo verificar / arreglar |
| ------- | -------------- | ------------------------- |
| El botón de IA aparece deshabilitado. | `VITE_OPENROUTER_API_KEY` vacía. | `isOpenRouterConfigured()` en `services/`. Añade la key a `.env.local` y `yarn dev`. |
| "El Plan Municipal todavía no está disponible." al primer arranque. | Embedding aún descargando (~120 MB). | Espera ~10–20 s la primera vez. El segundo arranque ya es <2 s. |
| El agente responde sin citas el Plan. | `rag_query` está devolviendo `below-threshold` y el modelo está alucinando. | Revisa que el system prompt no se haya alterado. Sube el `RAG_TOPK` o expande el pool de candidatos. Audita `formatDecisionForLLM` por si llegó un `RAG_STATUS=ok` que no debería. |
| El perímetro circular no aparece. | `setCircleCenter` / `setCircleRadius` no expuestos en el store o `setMode("perimeter")` faltante. | Revisa `applyPerimeterCircle`. Asegúrate de que la página `SeguridadPage` está montada (el flyTo + setMode lo requieren). |
| "Deshacer" no quita nada. | El operador ya borró manualmente la entidad → `removeXxx` no encuentra el id. | El handler devuelve "Nada que deshacer (ya no existe en el mapa)." — comportamiento correcto. |
| El agente repite la petición del usuario o dice "claro, voy a…". | Modelo demasiado conversacional o system prompt truncado. | Verifica que el `SYSTEM_PROMPT` se está enviando completo en `buildLlmMessages`. Algunos modelos con contexto pequeño truncan. |
| El input del chat no responde. | Hay ingesta de PDF en curso (`ingesting === true`). | Espera a que `RagStatusBar` muestre "Listo" o "Error". |
| "Demasiadas iteraciones — bucle interrumpido." | El modelo está atrapado pidiendo tools sin redactar respuesta. | Probable causa: instrucción ambigua que dispara `rag_query` repetido. Revisa el prompt y/o sube `MAX_TURNS` con cuidado. |
| El dictado por voz no inicia. | Navegador sin `webkitSpeechRecognition` (Firefox/Safari). | `useSpeechDictation.supported` será `false` → botón oculto. Solo Chrome/Edge. |

---

## 19. Limitaciones conocidas

- **API key en el bundle**: requiere proxy backend para producción.
- **Ventana de _Deshacer_ por sesión**: si el operador refresca, la tarjeta desaparece. Las entidades persisten en los stores (en memoria) pero no son revertibles desde el chat.
- **Sin persistencia de chat**: refrescar pierde el historial conversacional. El RAG sí persiste embeddings en IndexedDB.
- **Reintento RAG hard-coded a 1**: si el modelo necesita 2 reformulaciones, no las hará.
- **Tools secuenciales**: no se ejecutan tools en paralelo dentro de un turno.
- **Sin _streaming_ de respuesta**: la UI espera al `chatCompletion` completo. Modelos lentos se notan.
- **OCR no soportado**: PDFs escaneados se rechazan.
- **Sin búsqueda ANN**: trivial hasta ~5K chunks; sustituir si el corpus crece.
- **Aborto no cancela tools en vuelo**: si el LLM ya disparó una tool y el operador pulsa _Detener_, la mutación se aplica igualmente. El aborto solo corta la conversación con el LLM.
- **WebSpeech**: solo Chrome/Edge.
- **Nominatim _rate-limited_**: no contractual; sustituir en producción.

---

> **Mantenedor**: equipo Osprean. Cualquier cambio que afecte al system prompt, al catálogo de tools o al threshold/topK de RAG debe documentarse aquí en el mismo PR.
