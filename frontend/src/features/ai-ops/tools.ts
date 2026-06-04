// Catálogo de tools que la IA puede invocar desde el Centro Operativo.
// Cada tool tiene:
//   - definition: JSON schema enviado al LLM (function-calling)
//   - handler: ejecuta la acción contra los stores y devuelve un resultado
// El handler busca entidades por identificador AMIGABLE (callSign, code, road,
// nombre) en vez de IDs internos, porque eso es lo que el LLM va a pasar.

import {
  forwardGeocode,
  type ForwardGeocodeResult,
  type LngLat,
  type ToolDefinition,
} from "../../services";
import {
  useCampoStore,
  useDireccionStore,
  useEmergencyStore,
  useGabineteStore,
  useIncidentsStore,
  useLogisticaStore,
  useMapFlyStore,
  useSanitarioStore,
  useSeguridadStore,
  useTabsStore,
  selectActiveEmergency,
} from "../../store";
import type {
  AccessControlState,
  AmbulanceState,
  ChannelStatus,
  CommuniqueStatus,
  GeoPoint,
  LogisticsRequestPriority,
  LogisticsRequestStatus,
  MediaRequestStatus,
  OperationalLevel,
  PerimeterKind,
  SanitaryZoneKind,
  ServiceStatus,
  Severity,
  SupplyCategory,
  TabKey,
  TriageColor,
  VehicleState,
  VictimStatus,
} from "../../types";
import { PERIMETER_PALETTE } from "../../types";

// Convierte el parámetro 'color' de un tool a hex CSS. Acepta el nombre de un
// color de la paleta táctica ("red", "blue", "purple"…) o un hex directo
// ("#FF0033"). Devuelve undefined si no es válido o no se pasó nada — en ese
// caso el perímetro mantiene el color por defecto de su kind.
const resolveColor = (input?: unknown): string | undefined => {
  if (input == null) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)) return s;
  const named = PERIMETER_PALETTE.find((p) => p.name === s.toLowerCase());
  return named?.hex;
};

import type { AppliedAction, AppliedUndoSet } from "./aiOpsStore";
import {
  formatDecisionForLLM,
  listIngestedDocs,
  ragQuery,
} from "./rag";

export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
  // Si está presente, la acción YA se ejecutó sobre el mapa (auto-apply).
  // Contiene los ids creados para poder deshacer en la ventana de undo.
  applied?: AppliedAction;
}

export interface Tool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

// ───── helpers de búsqueda por identificador amigable ─────

const lc = (s: unknown) => String(s ?? "").toLowerCase().trim();

const findVehicleByCallSign = (callSign: string) => {
  const target = lc(callSign);
  return useLogisticaStore
    .getState()
    .vehicles.find((v) => lc(v.callSign) === target);
};

const findAmbulanceByCallSign = (callSign: string) => {
  const target = lc(callSign);
  return useSanitarioStore
    .getState()
    .ambulances.find((a) => lc(a.callSign) === target);
};

const findVictimByCode = (code: string) => {
  const target = lc(code);
  return useSanitarioStore
    .getState()
    .victims.find((v) => lc(v.code) === target);
};

const findHospitalByName = (name: string) => {
  const target = lc(name);
  return useSanitarioStore
    .getState()
    .hospitals.find((h) => lc(h.name).includes(target));
};

const findClosureByRoad = (road: string) => {
  const target = lc(road);
  const list = useSeguridadStore.getState().closures;
  return (
    list.find((c) => lc(c.road) === target) ??
    list.find((c) => lc(c.road).includes(target))
  );
};

const findSupplyByName = (name: string) => {
  const target = lc(name);
  return useLogisticaStore
    .getState()
    .supplies.find((s) => lc(s.name).includes(target));
};

const findRequestByItem = (ref: string) => {
  const target = lc(ref);
  return useLogisticaStore
    .getState()
    .requests.find((r) => lc(r.itemName).includes(target) || lc(r.id) === target);
};

const findServiceByKindArea = (kind: string, area?: string) => {
  const targetKind = lc(kind);
  const targetArea = area ? lc(area) : "";
  return useLogisticaStore
    .getState()
    .services.find(
      (s) => lc(s.kind) === targetKind && (!targetArea || lc(s.area).includes(targetArea)),
    );
};

// Los canales no tienen "name" — se identifican por kind ("press", "social-x"…)
// o por id. La IA suele pasar palabras como "prensa", "twitter", "instagram":
// hacemos un mapeo flexible para que cualquiera de esas variantes funcione.
const CHANNEL_ALIASES: Record<string, string[]> = {
  press: ["press", "prensa", "rueda de prensa"],
  "social-x": ["x", "twitter", "tuiter"],
  "social-instagram": ["instagram", "ig", "insta"],
  "social-facebook": ["facebook", "fb"],
  "es-alert": ["es-alert", "esalert", "alerta", "es alert"],
  rne: ["rne", "radio nacional"],
};

const findChannelByName = (name: string) => {
  const target = lc(name);
  const channels = useGabineteStore.getState().channels;
  const byId = channels.find((c) => lc(c.id) === target);
  if (byId) return byId;
  const byKind = channels.find((c) => lc(c.kind) === target);
  if (byKind) return byKind;
  for (const c of channels) {
    const aliases = CHANNEL_ALIASES[c.kind] ?? [];
    if (aliases.some((a) => target.includes(a))) return c;
  }
  return undefined;
};

const channelLabel = (kind: string) => kind.replace(/^social-/, "").toUpperCase();

const findCommuniqueByTitle = (title: string) => {
  const target = lc(title);
  return useDireccionStore
    .getState()
    .communiques.find((c) => lc(c.title).includes(target) || lc(c.id) === target);
};

// MediaRequest no tiene "outlet" / "topic"; usa requestedBy + reason + resourceType.
const findMediaRequestByRef = (ref: string) => {
  const target = lc(ref);
  return useDireccionStore
    .getState()
    .mediaRequests.find(
      (m) =>
        lc(m.id) === target ||
        lc(m.requestedBy).includes(target) ||
        lc(m.reason).includes(target) ||
        lc(m.resourceType).includes(target),
    );
};

// Pequeña pausa para que la UI reaccione a cada paso (cambio de tab, setMode,
// addDrawingPoint). Sin esto la creación se ve "atomic" y no parece dibujada.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Diff de ids: dado un array de items con `id` antes y después de la acción,
// devuelve los ids nuevos. Sirve para capturar exactamente lo que la acción
// creó (sin acoplar las funciones de los stores al saber sus ids generados).
const diffIds = <T extends { id: string }>(before: T[], after: T[]): string[] => {
  const seen = new Set(before.map((x) => x.id));
  return after.filter((x) => !seen.has(x.id)).map((x) => x.id);
};

// ───── aplicadores de acciones de mapa (auto-apply) ─────
// Cada uno ejecuta el flujo manual (flyTo → setMode → drawing → create*) y
// devuelve los ids creados para que el operador pueda deshacer la acción.

interface ApplyCloseStreetInput {
  road: string;
  reason: string;
  km?: string;
  segmentA: GeoPoint;
  segmentB: GeoPoint;
}
const applyCloseStreet = async (p: ApplyCloseStreetInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("seguridad");
  await sleep(250);
  useMapFlyStore.getState().flyToBounds([p.segmentA, p.segmentB], 1.5);
  const seg = useSeguridadStore.getState();
  const before = seg.closures;
  seg.setMode("closure");
  await sleep(1500);
  seg.addDrawingPoint(p.segmentA);
  await sleep(350);
  seg.addDrawingPoint(p.segmentB);
  await sleep(200);
  seg.createClosure({ road: p.road, km: p.km, reason: p.reason });
  return { closures: diffIds(before, useSeguridadStore.getState().closures) };
};

interface ApplyPerimeterPolygonInput {
  label: string;
  kind: PerimeterKind;
  level: 1 | 2 | 3;
  polygon: GeoPoint[];
  color?: string;
}
const applyPerimeterPolygon = async (p: ApplyPerimeterPolygonInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("seguridad");
  await sleep(250);
  useMapFlyStore.getState().flyToBounds(p.polygon, 1.5);
  const seg = useSeguridadStore.getState();
  const before = seg.perimeters;
  seg.setMode("perimeter");
  seg.setPerimeterShape("polygon");
  await sleep(1500);
  for (const pt of p.polygon) {
    seg.addDrawingPoint(pt);
    await sleep(180);
  }
  seg.createPerimeter({ kind: p.kind, label: p.label, level: p.level, color: p.color });
  return { perimeters: diffIds(before, useSeguridadStore.getState().perimeters) };
};

interface ApplyPerimeterCircleInput {
  label: string;
  kind: PerimeterKind;
  level: 1 | 2 | 3;
  center: GeoPoint;
  radius: number;
  color?: string;
}
const applyPerimeterCircle = async (p: ApplyPerimeterCircleInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("seguridad");
  await sleep(250);
  useMapFlyStore.getState().flyToPoint(p.center, 16, 1.3);
  const seg = useSeguridadStore.getState();
  const before = seg.perimeters;
  seg.setMode("perimeter");
  seg.setPerimeterShape("circle");
  await sleep(1300);
  seg.setCircleCenter(p.center);
  seg.setCircleRadius(p.radius);
  await sleep(200);
  seg.createPerimeter({ kind: p.kind, label: p.label, level: p.level, color: p.color });
  return { perimeters: diffIds(before, useSeguridadStore.getState().perimeters) };
};

interface ApplyCheckpointInput {
  label: string;
  state: AccessControlState;
  units?: number;
  reason?: string;
  point: GeoPoint;
}
const applyCheckpoint = async (p: ApplyCheckpointInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("seguridad");
  await sleep(250);
  useMapFlyStore.getState().flyToPoint(p.point, 17, 1.3);
  const seg = useSeguridadStore.getState();
  const before = seg.accessControls;
  seg.setMode("access");
  await sleep(1300);
  seg.setPendingPoint(p.point);
  await sleep(200);
  seg.createAccessControl({
    kind: "checkpoint",
    label: p.label,
    state: p.state,
    units: p.units,
    reason: p.reason,
  });
  return { accessControls: diffIds(before, useSeguridadStore.getState().accessControls) };
};

interface ApplyVictimInput {
  triage: TriageColor;
  age?: number;
  gender?: "M" | "F" | "X";
  injuries?: string;
  notes?: string;
  point: GeoPoint;
}
const applyVictim = async (p: ApplyVictimInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("sanitario");
  await sleep(250);
  useMapFlyStore.getState().flyToPoint(p.point, 17, 1.3);
  const san = useSanitarioStore.getState();
  const before = san.victims;
  san.setMode("victim");
  await sleep(1300);
  san.setPendingPoint(p.point);
  await sleep(200);
  san.registerVictim({
    triage: p.triage,
    age: p.age,
    gender: p.gender,
    injuries: p.injuries,
    notes: p.notes,
  });
  return { victims: diffIds(before, useSanitarioStore.getState().victims) };
};

interface ApplyIncidentInput {
  title: string;
  notes?: string;
  severity: Severity;
  point: GeoPoint;
}
const applyIncident = async (p: ApplyIncidentInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("seguridad");
  await sleep(250);
  useMapFlyStore.getState().flyToPoint(p.point, 17, 1.3);
  const seg = useSeguridadStore.getState();
  const before = useIncidentsStore.getState().incidents;
  seg.setMode("incident");
  await sleep(1300);
  seg.setPendingPoint(p.point);
  await sleep(200);
  // Inyectamos la severidad antes de delegar: registerIncident usa "medium"
  // por defecto, así que parcheamos el incident recién creado tras el alta.
  seg.registerIncident({ title: p.title, notes: p.notes ?? "" });
  const after = useIncidentsStore.getState().incidents;
  const newIds = diffIds(before, after);
  if (newIds[0] && p.severity !== "medium") {
    const inc = after.find((i) => i.id === newIds[0]);
    if (inc) useIncidentsStore.getState().upsertIncident({ ...inc, severity: p.severity });
  }
  return { incidents: newIds };
};

interface ApplyZoneInput {
  kind: SanitaryZoneKind;
  label: string;
  capacity?: number;
  point: GeoPoint;
}
const applyZone = async (p: ApplyZoneInput): Promise<AppliedUndoSet> => {
  useTabsStore.getState().setActiveTab("sanitario");
  await sleep(250);
  useMapFlyStore.getState().flyToPoint(p.point, 17, 1.3);
  const san = useSanitarioStore.getState();
  const before = san.zones;
  const m = p.kind === "first-aid" ? "first-aid" : p.kind === "triage-point" ? "triage-point" : "victim";
  san.setMode(m as "first-aid" | "triage-point" | "victim");
  await sleep(1300);
  san.setPendingPoint(p.point);
  await sleep(200);
  san.addZone({ kind: p.kind, label: p.label, capacity: p.capacity });
  return { sanitaryZones: diffIds(before, useSanitarioStore.getState().zones) };
};

// Convierte una bbox de Nominatim [south, north, west, east] a dos puntos
// extremos a lo largo de la diagonal del bbox. Se usa para sintetizar el
// segmento de un cierre vial a partir del nombre de una calle.
const bboxToSegment = (bbox: [number, number, number, number]): [GeoPoint, GeoPoint] => {
  const [south, north, west, east] = bbox;
  return [
    { lat: south, lng: west },
    { lat: north, lng: east },
  ];
};

// Convierte un bbox en un polígono de 4 puntos (rectángulo de la zona).
const bboxToPolygon = (bbox: [number, number, number, number]): GeoPoint[] => {
  const [south, north, west, east] = bbox;
  return [
    { lat: south, lng: west },
    { lat: south, lng: east },
    { lat: north, lng: east },
    { lat: north, lng: west },
  ];
};

// ───── geometría real OSM ─────

const toGeoPoint = ([lng, lat]: LngLat): GeoPoint => ({ lat, lng });

// Distancia aproximada en metros entre dos puntos (haversine simplificada).
const dist = (a: GeoPoint, b: GeoPoint) => {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Interpola un punto sobre una polilínea en la posición t∈[0,1] del recorrido total.
// Esto permite extraer dos extremos "honestos" del vial real (no la diagonal del bbox).
const pointAlongPolyline = (line: GeoPoint[], t: number): GeoPoint => {
  if (line.length < 2) return line[0];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = dist(line[i - 1], line[i]);
    segs.push(d);
    total += d;
  }
  if (total === 0) return line[0];
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const frac = segs[i] === 0 ? 0 : (target - acc) / segs[i];
      const a = line[i];
      const b = line[i + 1];
      return { lat: a.lat + frac * (b.lat - a.lat), lng: a.lng + frac * (b.lng - a.lng) };
    }
    acc += segs[i];
  }
  return line[line.length - 1];
};

// Saca la polilínea más larga de una geometría (cubre LineString y MultiLineString).
const extractLongestLine = (geom: ForwardGeocodeResult["geometry"]): GeoPoint[] | null => {
  if (!geom) return null;
  if (geom.type === "LineString") return geom.coordinates.map(toGeoPoint);
  if (geom.type === "MultiLineString") {
    let best: GeoPoint[] | null = null;
    let bestLen = 0;
    for (const part of geom.coordinates) {
      const line = part.map(toGeoPoint);
      let len = 0;
      for (let i = 1; i < line.length; i++) len += dist(line[i - 1], line[i]);
      if (len > bestLen) {
        bestLen = len;
        best = line;
      }
    }
    return best;
  }
  return null;
};

// Saca el anillo exterior del polígono más grande (cubre Polygon y MultiPolygon).
const extractOuterRing = (geom: ForwardGeocodeResult["geometry"]): GeoPoint[] | null => {
  if (!geom) return null;
  if (geom.type === "Polygon" && geom.coordinates[0]) {
    return geom.coordinates[0].map(toGeoPoint);
  }
  if (geom.type === "MultiPolygon") {
    let best: GeoPoint[] | null = null;
    let bestN = 0;
    for (const poly of geom.coordinates) {
      const ring = poly[0]?.map(toGeoPoint) ?? [];
      if (ring.length > bestN) {
        bestN = ring.length;
        best = ring;
      }
    }
    return best;
  }
  return null;
};

// Reduce una polilínea a N puntos equiespaciados sobre su recorrido. Si la
// línea original tiene menos puntos que N, la devolvemos tal cual.
const simplifyAlong = (line: GeoPoint[], n: number): GeoPoint[] => {
  if (line.length <= n) return line;
  const out: GeoPoint[] = [];
  for (let i = 0; i < n; i++) {
    out.push(pointAlongPolyline(line, i / (n - 1)));
  }
  return out;
};

// Para cerrar una calle: usamos la geometría real del vial. Tomamos los puntos
// al 10% y al 90% del recorrido para que el segmento quede claramente SOBRE la
// calle, alineado con su dirección, en lugar de la diagonal del bbox.
const geocodeForSegment = async (
  query: string,
): Promise<{ segment: [GeoPoint, GeoPoint]; displayName: string } | null> => {
  const r = await forwardGeocode(query);
  if (!r) return null;
  const line = extractLongestLine(r.geometry);
  if (line && line.length >= 2) {
    const a = pointAlongPolyline(line, 0.1);
    const b = pointAlongPolyline(line, 0.9);
    if (dist(a, b) > 5) {
      return { segment: [a, b], displayName: r.displayName };
    }
  }
  // Sin geometría: fallback bbox o expansión alrededor del punto.
  if (r.boundingBox) {
    const seg = bboxToSegment(r.boundingBox);
    const dLat = Math.abs(seg[1].lat - seg[0].lat);
    const dLng = Math.abs(seg[1].lng - seg[0].lng);
    if (dLat < 0.0005 && dLng < 0.0005) {
      return {
        segment: [
          { lat: r.lat - 0.0006, lng: r.lng - 0.0006 },
          { lat: r.lat + 0.0006, lng: r.lng + 0.0006 },
        ],
        displayName: r.displayName,
      };
    }
    return { segment: seg, displayName: r.displayName };
  }
  return {
    segment: [
      { lat: r.lat - 0.0006, lng: r.lng - 0.0006 },
      { lat: r.lat + 0.0006, lng: r.lng + 0.0006 },
    ],
    displayName: r.displayName,
  };
};

// Para perímetros: usamos el polígono real OSM (barrio/zona). Reducido a 12
// puntos para que el dibujo sea estable sin perder fidelidad.
const geocodeForPolygon = async (
  query: string,
): Promise<{ polygon: GeoPoint[]; displayName: string } | null> => {
  const r = await forwardGeocode(query);
  if (!r) return null;
  const ring = extractOuterRing(r.geometry);
  if (ring && ring.length >= 3) {
    // El primer y último punto suelen coincidir en GeoJSON; quitamos el cierre.
    const open = ring[0].lat === ring[ring.length - 1].lat && ring[0].lng === ring[ring.length - 1].lng
      ? ring.slice(0, -1)
      : ring;
    const polygon = simplifyAlong(open, Math.min(12, open.length));
    return { polygon, displayName: r.displayName };
  }
  // Fallback bbox.
  if (r.boundingBox) {
    const poly = bboxToPolygon(r.boundingBox);
    const dLat = Math.abs(poly[2].lat - poly[0].lat);
    const dLng = Math.abs(poly[1].lng - poly[0].lng);
    if (dLat < 0.001 && dLng < 0.001) {
      return {
        polygon: bboxToPolygon([r.lat - 0.002, r.lat + 0.002, r.lng - 0.002, r.lng + 0.002]),
        displayName: r.displayName,
      };
    }
    return { polygon: poly, displayName: r.displayName };
  }
  return {
    polygon: bboxToPolygon([r.lat - 0.002, r.lat + 0.002, r.lng - 0.002, r.lng + 0.002]),
    displayName: r.displayName,
  };
};

const geocodeForPoint = async (
  query: string,
): Promise<{ point: GeoPoint; displayName: string } | null> => {
  const r = await forwardGeocode(query);
  if (!r) return null;
  return { point: { lat: r.lat, lng: r.lng }, displayName: r.displayName };
};

// ───── TOOLS ─────

export const TOOLS: Tool[] = [
  // ═══════════ NAVEGACIÓN ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "goto_tab",
        description: "Cambia la pestaña activa del panel. Útil para llevar al operador a la sección relevante antes/después de ejecutar acciones.",
        parameters: {
          type: "object",
          properties: {
            tab: {
              type: "string",
              enum: ["direccion", "seguridad", "sanitario", "logistica", "gabinete", "campo"],
              description: "Pestaña destino",
            },
          },
          required: ["tab"],
        },
      },
    },
    handler: ({ tab }) => {
      useTabsStore.getState().setActiveTab(tab as TabKey);
      return { ok: true, message: `Pestaña cambiada a "${tab}".` };
    },
  },

  // ═══════════ SEGURIDAD ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_close_street",
        description: "Corta una calle/vía al tráfico. Auto-aplica al mapa: el operador puede deshacer en una ventana breve. Geocodifica el nombre de la calle.",
        parameters: {
          type: "object",
          properties: {
            road: { type: "string", description: "Nombre de la calle/carretera. Incluye ciudad si es ambiguo (p.ej. 'Calle Mayor, Madrid')." },
            reason: { type: "string", description: "Motivo del corte." },
            km: { type: "string", description: "Punto kilométrico (opcional)." },
          },
          required: ["road", "reason"],
        },
      },
    },
    handler: async ({ road, reason, km }) => {
      const found = await geocodeForSegment(String(road));
      if (!found) {
        return { ok: false, message: `No se pudo geolocalizar la calle "${road}". Prueba a precisar la ciudad (p.ej. "Calle Mayor, Madrid").` };
      }
      const displayShort = found.displayName.split(",").slice(0, 3).join(", ").trim();
      const undo = await applyCloseStreet({
        road: String(road),
        reason: String(reason),
        km: km ? String(km) : undefined,
        segmentA: found.segment[0],
        segmentB: found.segment[1],
      });
      return {
        ok: true,
        message: `Calle "${road}"${km ? ` (km ${km})` : ""} cortada en ${displayShort}. Motivo: ${reason}.`,
        applied: {
          kind: "close_street",
          summary: `Cortada "${road}"${km ? ` (km ${km})` : ""}`,
          detail: `${displayShort} · ${reason}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_create_perimeter",
        description: "Crea un perímetro de seguridad. Dos modos: (1) POLÍGONO desde una zona/barrio textual ('area') que se geocodifica, o (2) CÍRCULO con centro (centerLat/centerLng o centerRef='emergency'|VIC-XXX|AMB-XX) y radio en metros. Usa el círculo cuando el operador hable de 'radio', 'metros alrededor' o quiera un perímetro centrado en un punto del mapa. Si el operador especifica un color para el perímetro, pásalo por 'color'.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Etiqueta del perímetro." },
            kind: { type: "string", enum: ["evacuation", "exclusion", "control", "safety"], description: "Tipo de perímetro." },
            level: { type: "number", enum: [1, 2, 3], description: "Nivel de criticidad." },
            area: { type: "string", description: "MODO POLÍGONO: zona/barrio/dirección a delimitar." },
            centerLat: { type: "number", description: "MODO CÍRCULO: latitud del centro." },
            centerLng: { type: "number", description: "MODO CÍRCULO: longitud del centro." },
            centerRef: { type: "string", description: "MODO CÍRCULO: alternativa a centerLat/centerLng. Identificador del punto central: 'emergency' (origen de la emergencia), VIC-XXX, AMB-XX." },
            radiusMeters: { type: "number", description: "MODO CÍRCULO: radio en metros." },
            color: { type: "string", description: "Color opcional del perímetro. Sobreescribe el color por defecto del tipo. Acepta un nombre de la paleta táctica ('red','orange','yellow','green','teal','blue','purple','pink') o un hex CSS ('#FF8800')." },
          },
          required: ["label", "kind", "level"],
        },
      },
    },
    handler: async ({ label, kind, level, area, centerLat, centerLng, centerRef, radiusMeters, color }) => {
      const resolvedColor = resolveColor(color);
      const wantCircle =
        typeof radiusMeters === "number" &&
        (typeof centerLat === "number" || typeof centerLng === "number" || centerRef);

      if (wantCircle) {
        let center: GeoPoint | null = null;
        let centerLabel = "";
        if (typeof centerLat === "number" && typeof centerLng === "number") {
          center = { lat: Number(centerLat), lng: Number(centerLng) };
          centerLabel = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
        } else if (centerRef) {
          const r = String(centerRef).trim();
          if (lc(r) === "emergency" || lc(r) === "emergencia" || lc(r) === "origen") {
            const em = selectActiveEmergency(useEmergencyStore.getState());
            if (em) {
              center = em.location;
              centerLabel = `origen ${em.code}`;
            }
          } else {
            const v = findVictimByCode(r);
            if (v) {
              center = v.location;
              centerLabel = v.code;
            } else {
              const a = findAmbulanceByCallSign(r);
              if (a) {
                center = a.location;
                centerLabel = a.callSign;
              }
            }
          }
        }
        if (!center) {
          return { ok: false, message: "Centro no resuelto. Pasa centerLat/centerLng o centerRef ('emergency', VIC-XXX, AMB-XX)." };
        }
        const radius = Number(radiusMeters);
        if (!(radius > 0)) {
          return { ok: false, message: "radiusMeters debe ser > 0." };
        }
        const undo = await applyPerimeterCircle({
          label: String(label),
          kind: kind as PerimeterKind,
          level: Number(level) as 1 | 2 | 3,
          center,
          radius,
          color: resolvedColor,
        });
        return {
          ok: true,
          message: `Perímetro circular "${label}" (${kind}, nivel ${level}) creado — radio ${Math.round(radius)} m en ${centerLabel}${resolvedColor ? ` · color ${resolvedColor}` : ""}.`,
          applied: {
            kind: "create_perimeter",
            summary: `Perímetro circular "${label}"`,
            detail: `${kind} · nivel ${level} · radio ${Math.round(radius)} m · ${centerLabel}${resolvedColor ? ` · ${resolvedColor}` : ""}`,
            undo,
            appliedAt: new Date().toISOString(),
          },
        };
      }

      if (!area) {
        return { ok: false, message: "Falta 'area' (modo polígono) o centro+radio (modo círculo)." };
      }
      const found = await geocodeForPolygon(String(area));
      if (!found) {
        return { ok: false, message: `No se pudo geolocalizar la zona "${area}".` };
      }
      const displayShort = found.displayName.split(",").slice(0, 2).join(", ").trim();
      const undo = await applyPerimeterPolygon({
        label: String(label),
        kind: kind as PerimeterKind,
        level: Number(level) as 1 | 2 | 3,
        polygon: found.polygon,
        color: resolvedColor,
      });
      return {
        ok: true,
        message: `Perímetro "${label}" (${kind}, nivel ${level}) creado en ${displayShort}${resolvedColor ? ` · color ${resolvedColor}` : ""}.`,
        applied: {
          kind: "create_perimeter",
          summary: `Perímetro "${label}"`,
          detail: `${kind} · nivel ${level} · ${displayShort}${resolvedColor ? ` · ${resolvedColor}` : ""}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_create_checkpoint",
        description: "Despliega un control de acceso (checkpoint) en una ubicación. Usa lat/lng si los conoces (p.ej. obtenidos de map_get_emergency o map_list_points); si no, pasa una dirección textual y se geocodificará.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Etiqueta del control." },
            location: { type: "string", description: "Dirección/punto donde desplegar el control (alternativa a lat/lng)." },
            lat: { type: "number", description: "Latitud exacta (alternativa a location)." },
            lng: { type: "number", description: "Longitud exacta (alternativa a location)." },
            units: { type: "number", description: "Número de efectivos (opcional)." },
            reason: { type: "string", description: "Motivo (opcional)." },
            state: { type: "string", enum: ["open", "restricted", "closed"], description: "Estado inicial. Por defecto 'restricted'." },
          },
          required: ["label"],
        },
      },
    },
    handler: async ({ label, location, lat, lng, units, reason, state }) => {
      let point: GeoPoint;
      let displayShort: string;
      let displayName: string;
      if (typeof lat === "number" && typeof lng === "number") {
        point = { lat: Number(lat), lng: Number(lng) };
        displayShort = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
        displayName = displayShort;
      } else {
        if (!location) {
          return { ok: false, message: "Falta ubicación: pasa lat/lng o un texto en 'location'." };
        }
        const found = await geocodeForPoint(String(location));
        if (!found) {
          return { ok: false, message: `No se pudo geolocalizar "${location}".` };
        }
        point = found.point;
        displayName = found.displayName;
        displayShort = found.displayName.split(",").slice(0, 2).join(", ").trim();
      }
      const undo = await applyCheckpoint({
        label: String(label),
        state: (state as AccessControlState) ?? "restricted",
        units: units != null ? Number(units) : undefined,
        reason: reason ? String(reason) : undefined,
        point,
      });
      void displayName;
      return {
        ok: true,
        message: `Control "${label}" desplegado en ${displayShort}${units ? ` (${units} efectivos)` : ""}.`,
        applied: {
          kind: "create_checkpoint",
          summary: `Control "${label}"`,
          detail: `${displayShort}${units ? ` · ${units} efectivos` : ""}${reason ? ` · ${reason}` : ""}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_lift_closure",
        description: "Reabre al tráfico una calle previamente cortada. Busca por nombre de la calle.",
        parameters: {
          type: "object",
          properties: {
            road: { type: "string", description: "Nombre de la calle a reabrir." },
          },
          required: ["road"],
        },
      },
    },
    handler: ({ road }) => {
      const c = findClosureByRoad(String(road));
      if (!c) return { ok: false, message: `No se encontró ningún cierre para "${road}".` };
      useSeguridadStore.getState().liftClosure(c.id);
      return { ok: true, message: `Cierre de "${c.road}" reabierto al tráfico.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_remove_closure",
        description: "Elimina por completo un cierre vial del mapa (no lo deja como 'levantado'). Úsalo cuando el operador diga 'borrar', 'quitar', 'eliminar' un cierre.",
        parameters: {
          type: "object",
          properties: {
            road: { type: "string", description: "Nombre de la calle del cierre a borrar." },
          },
          required: ["road"],
        },
      },
    },
    handler: ({ road }) => {
      const c = findClosureByRoad(String(road));
      if (!c) return { ok: false, message: `No se encontró ningún cierre para "${road}".` };
      useSeguridadStore.getState().removeClosure(c.id);
      return { ok: true, message: `Cierre de "${c.road}" eliminado.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_remove_perimeter",
        description: "Elimina un perímetro de seguridad por su etiqueta.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Etiqueta del perímetro." },
          },
          required: ["label"],
        },
      },
    },
    handler: ({ label }) => {
      const target = lc(label);
      const p = useSeguridadStore
        .getState()
        .perimeters.find((x) => lc(x.label).includes(target));
      if (!p) return { ok: false, message: `Perímetro "${label}" no encontrado.` };
      useSeguridadStore.getState().removePerimeter(p.id);
      return { ok: true, message: `Perímetro "${p.label}" eliminado.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_remove_checkpoint",
        description: "Elimina un control de acceso por su etiqueta.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Etiqueta del control." },
          },
          required: ["label"],
        },
      },
    },
    handler: ({ label }) => {
      const target = lc(label);
      const ac = useSeguridadStore
        .getState()
        .accessControls.find((x) => lc(x.label).includes(target));
      if (!ac) return { ok: false, message: `Control "${label}" no encontrado.` };
      useSeguridadStore.getState().removeAccessControl(ac.id);
      return { ok: true, message: `Control "${ac.label}" eliminado.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_remove_victim",
        description: "Elimina una víctima por su código (VIC-XXX).",
        parameters: {
          type: "object",
          properties: {
            victimCode: { type: "string" },
          },
          required: ["victimCode"],
        },
      },
    },
    handler: ({ victimCode }) => {
      const v = findVictimByCode(String(victimCode));
      if (!v) return { ok: false, message: `Víctima "${victimCode}" no encontrada.` };
      useSanitarioStore.getState().removeVictim(v.id);
      return { ok: true, message: `Víctima ${v.code} eliminada.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_remove_zone",
        description: "Elimina una zona sanitaria por su etiqueta.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string" },
          },
          required: ["label"],
        },
      },
    },
    handler: ({ label }) => {
      const target = lc(label);
      const z = useSanitarioStore
        .getState()
        .zones.find((x) => lc(x.label).includes(target));
      if (!z) return { ok: false, message: `Zona "${label}" no encontrada.` };
      useSanitarioStore.getState().removeZone(z.id);
      return { ok: true, message: `Zona "${z.label}" eliminada.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_list_closures",
        description: "Lista los cierres viales activos (no levantados).",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useSeguridadStore
        .getState()
        .closures.filter((c) => c.status === "active");
      if (!list.length) return { ok: true, message: "No hay cierres viales activos." };
      const lines = list.map((c) => `· ${c.road}${c.km ? ` km ${c.km}` : ""} — ${c.reason}`);
      return { ok: true, message: `${list.length} cierre(s) activo(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_set_access_state",
        description: "Cambia el estado de un control de acceso (checkpoint) por nombre.",
        parameters: {
          type: "object",
          properties: {
            label: { type: "string", description: "Etiqueta del control." },
            state: { type: "string", enum: ["open", "restricted", "closed"] },
          },
          required: ["label", "state"],
        },
      },
    },
    handler: ({ label, state }) => {
      const target = lc(label);
      const ac = useSeguridadStore
        .getState()
        .accessControls.find((x) => lc(x.label).includes(target));
      if (!ac) return { ok: false, message: `No se encontró control "${label}".` };
      useSeguridadStore.getState().setAccessState(ac.id, state as AccessControlState);
      return { ok: true, message: `Control "${ac.label}" → ${state}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_register_evacuation",
        description: "Registra una evacuación de personas desde un punto a un albergue.",
        parameters: {
          type: "object",
          properties: {
            count: { type: "number", description: "Número de personas evacuadas." },
            from: { type: "string", description: "Origen." },
            toShelter: { type: "string", description: "Albergue destino." },
          },
          required: ["count", "from", "toShelter"],
        },
      },
    },
    handler: ({ count, from, toShelter }) => {
      useSeguridadStore.getState().registerEvacuation({
        count: Number(count),
        from: String(from),
        toShelter: String(toShelter),
      });
      return { ok: true, message: `${count} personas evacuadas de "${from}" a "${toShelter}".` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_register_incident",
        description:
          "Reporta una incidencia de seguridad sobre el mapa. Necesita título y ubicación (lat/lng, texto que se geocodifica, o ref='emergency'|VIC-XXX|AMB-XX). Si el operador no aporta título o ubicación, NO llames a esta tool — pídeselos primero en una pregunta corta. Severidad opcional (por defecto 'medium').",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Título corto de la incidencia (ej. 'Persona perdida en parque')." },
            notes: { type: "string", description: "Detalles adicionales (opcional)." },
            severity: {
              type: "string",
              enum: ["critical", "high", "medium", "low", "info"],
              description: "Severidad (opcional, por defecto 'medium').",
            },
            location: { type: "string", description: "Dirección o punto en texto (alternativa a lat/lng o ref)." },
            lat: { type: "number", description: "Latitud exacta (alternativa a location/ref)." },
            lng: { type: "number", description: "Longitud exacta (alternativa a location/ref)." },
            ref: { type: "string", description: "Referencia a un punto del mapa: 'emergency', VIC-XXX, AMB-XX." },
          },
          required: ["title"],
        },
      },
    },
    handler: async ({ title, notes, severity, location, lat, lng, ref }) => {
      const titleStr = String(title ?? "").trim();
      if (!titleStr) {
        return { ok: false, message: "Falta el título de la incidencia." };
      }
      let point: GeoPoint | null = null;
      let displayShort = "";
      if (typeof lat === "number" && typeof lng === "number") {
        point = { lat: Number(lat), lng: Number(lng) };
        displayShort = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
      } else if (ref) {
        const r = String(ref).trim();
        if (lc(r) === "emergency" || lc(r) === "emergencia" || lc(r) === "origen") {
          const em = selectActiveEmergency(useEmergencyStore.getState());
          if (em) {
            point = em.location;
            displayShort = `origen ${em.code}`;
          }
        } else {
          const v = findVictimByCode(r);
          if (v) {
            point = v.location;
            displayShort = v.code;
          } else {
            const a = findAmbulanceByCallSign(r);
            if (a) {
              point = a.location;
              displayShort = a.callSign;
            }
          }
        }
        if (!point) {
          return { ok: false, message: `No he podido resolver la referencia "${ref}". Usa 'emergency', VIC-XXX, AMB-XX o pasa lat/lng.` };
        }
      } else if (location) {
        const found = await geocodeForPoint(String(location));
        if (!found) {
          return { ok: false, message: `No se pudo geolocalizar "${location}". Pásame lat/lng o una ref ('emergency', VIC-XXX, AMB-XX).` };
        }
        point = found.point;
        displayShort = found.displayName.split(",").slice(0, 2).join(", ").trim();
      } else {
        return {
          ok: false,
          message: "Falta la ubicación de la incidencia: pásame lat/lng, un texto en 'location', o ref ('emergency', VIC-XXX, AMB-XX).",
        };
      }

      const sev: Severity = (
        ["critical", "high", "medium", "low", "info"].includes(String(severity))
          ? (severity as Severity)
          : "medium"
      );
      const undo = await applyIncident({
        title: titleStr,
        notes: notes ? String(notes) : undefined,
        severity: sev,
        point,
      });
      return {
        ok: true,
        message: `Incidencia "${titleStr}" registrada en ${displayShort} (${sev}).`,
        applied: {
          kind: "register_incident",
          summary: `Incidencia "${titleStr}"`,
          detail: `${displayShort} · ${sev}${notes ? ` · ${String(notes)}` : ""}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },

  // ═══════════ SANITARIO ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_register_victim",
        description: "Registra una nueva víctima en una ubicación. Usa lat/lng si los conoces (p.ej. del origen de la emergencia vía map_get_emergency); si no, pasa 'location' como texto y se geocodificará.",
        parameters: {
          type: "object",
          properties: {
            triage: { type: "string", enum: ["red", "yellow", "green", "black", "unset"] },
            location: { type: "string", description: "Dónde está la víctima (dirección o punto, alternativa a lat/lng)." },
            lat: { type: "number", description: "Latitud exacta (alternativa a location)." },
            lng: { type: "number", description: "Longitud exacta (alternativa a location)." },
            age: { type: "number" },
            gender: { type: "string", enum: ["M", "F", "X"] },
            injuries: { type: "string" },
            notes: { type: "string" },
          },
          required: ["triage"],
        },
      },
    },
    handler: async ({ triage, location, lat, lng, age, gender, injuries, notes }) => {
      let point: GeoPoint;
      let displayShort: string;
      let displayName: string;
      if (typeof lat === "number" && typeof lng === "number") {
        point = { lat: Number(lat), lng: Number(lng) };
        displayShort = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
        displayName = displayShort;
      } else {
        if (!location) {
          return { ok: false, message: "Falta ubicación: pasa lat/lng o un texto en 'location'." };
        }
        const found = await geocodeForPoint(String(location));
        if (!found) {
          return { ok: false, message: `No se pudo geolocalizar "${location}".` };
        }
        point = found.point;
        displayName = found.displayName;
        displayShort = found.displayName.split(",").slice(0, 2).join(", ").trim();
      }
      const undo = await applyVictim({
        triage: triage as TriageColor,
        age: age != null ? Number(age) : undefined,
        gender: gender as "M" | "F" | "X" | undefined,
        injuries: injuries ? String(injuries) : undefined,
        notes: notes ? String(notes) : undefined,
        point,
      });
      void displayName;
      const newCode = useSanitarioStore.getState().victims.find((v) => undo.victims?.includes(v.id))?.code;
      return {
        ok: true,
        message: `Víctima ${newCode ?? ""} registrada (triaje ${triage}) en ${displayShort}.`,
        applied: {
          kind: "register_victim",
          summary: `Víctima ${newCode ?? ""} (triaje ${triage})`,
          detail: `${displayShort}${age != null ? ` · ${age}a` : ""}${gender ? ` · ${gender}` : ""}${injuries ? ` · ${injuries}` : ""}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_add_zone",
        description: "Crea una zona sanitaria (triage-point, first-aid, zone) en una ubicación. Usa lat/lng si los conoces (p.ej. desde map_get_emergency); si no, pasa 'location' como texto y se geocodificará.",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["triage-point", "first-aid", "zone"] },
            label: { type: "string" },
            location: { type: "string", description: "Dirección o punto (alternativa a lat/lng)." },
            lat: { type: "number", description: "Latitud exacta (alternativa a location)." },
            lng: { type: "number", description: "Longitud exacta (alternativa a location)." },
            capacity: { type: "number" },
          },
          required: ["kind", "label"],
        },
      },
    },
    handler: async ({ kind, label, location, lat, lng, capacity }) => {
      let point: GeoPoint;
      let displayShort: string;
      let displayName: string;
      if (typeof lat === "number" && typeof lng === "number") {
        point = { lat: Number(lat), lng: Number(lng) };
        displayShort = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
        displayName = displayShort;
      } else {
        if (!location) {
          return { ok: false, message: "Falta ubicación: pasa lat/lng o un texto en 'location'." };
        }
        const found = await geocodeForPoint(String(location));
        if (!found) return { ok: false, message: `No se pudo geolocalizar "${location}".` };
        point = found.point;
        displayName = found.displayName;
        displayShort = found.displayName.split(",").slice(0, 2).join(", ").trim();
      }
      const undo = await applyZone({
        kind: kind as SanitaryZoneKind,
        label: String(label),
        capacity: capacity != null ? Number(capacity) : undefined,
        point,
      });
      void displayName;
      return {
        ok: true,
        message: `Zona "${label}" (${kind}) creada en ${displayShort}.`,
        applied: {
          kind: "add_zone",
          summary: `Zona "${label}" (${kind})`,
          detail: `${displayShort}${capacity != null ? ` · capacidad ${capacity}` : ""}`,
          undo,
          appliedAt: new Date().toISOString(),
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_update_triage",
        description: "Cambia el nivel de triaje de una víctima identificada por su código (VIC-XXX).",
        parameters: {
          type: "object",
          properties: {
            victimCode: { type: "string", description: "Código de víctima, p.ej. 'VIC-003'." },
            triage: { type: "string", enum: ["red", "yellow", "green", "black", "unset"] },
          },
          required: ["victimCode", "triage"],
        },
      },
    },
    handler: ({ victimCode, triage }) => {
      const v = findVictimByCode(String(victimCode));
      if (!v) return { ok: false, message: `No se encontró víctima "${victimCode}".` };
      useSanitarioStore.getState().updateTriage(v.id, triage as TriageColor);
      return { ok: true, message: `${v.code}: triaje → ${triage}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_set_victim_status",
        description: "Cambia el estado clínico/operativo de una víctima por su código.",
        parameters: {
          type: "object",
          properties: {
            victimCode: { type: "string" },
            status: {
              type: "string",
              enum: ["on-scene", "in-triage", "stabilized", "evacuating", "delivered", "discharged"],
            },
          },
          required: ["victimCode", "status"],
        },
      },
    },
    handler: ({ victimCode, status }) => {
      const v = findVictimByCode(String(victimCode));
      if (!v) return { ok: false, message: `No se encontró víctima "${victimCode}".` };
      useSanitarioStore.getState().setVictimStatus(v.id, status as VictimStatus);
      return { ok: true, message: `${v.code}: estado → ${status}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_assign_ambulance",
        description: "Asigna una ambulancia a una víctima. Identificadores por código (VIC-XXX) e indicativo (AMB-XX).",
        parameters: {
          type: "object",
          properties: {
            victimCode: { type: "string" },
            ambulanceCallSign: { type: "string" },
          },
          required: ["victimCode", "ambulanceCallSign"],
        },
      },
    },
    handler: ({ victimCode, ambulanceCallSign }) => {
      const v = findVictimByCode(String(victimCode));
      const a = findAmbulanceByCallSign(String(ambulanceCallSign));
      if (!v) return { ok: false, message: `Víctima "${victimCode}" no encontrada.` };
      if (!a) return { ok: false, message: `Ambulancia "${ambulanceCallSign}" no encontrada.` };
      useSanitarioStore.getState().assignAmbulance(v.id, a.id);
      return { ok: true, message: `${a.callSign} asignada a ${v.code}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_derive_to_hospital",
        description: "Deriva una víctima a un hospital (por nombre parcial).",
        parameters: {
          type: "object",
          properties: {
            victimCode: { type: "string" },
            hospitalName: { type: "string" },
          },
          required: ["victimCode", "hospitalName"],
        },
      },
    },
    handler: ({ victimCode, hospitalName }) => {
      const v = findVictimByCode(String(victimCode));
      const h = findHospitalByName(String(hospitalName));
      if (!v) return { ok: false, message: `Víctima "${victimCode}" no encontrada.` };
      if (!h) return { ok: false, message: `Hospital "${hospitalName}" no encontrado.` };
      useSanitarioStore.getState().deriveToHospital(v.id, h.id);
      return { ok: true, message: `${v.code} derivada a ${h.name}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_set_ambulance_state",
        description: "Cambia el estado de una ambulancia por indicativo.",
        parameters: {
          type: "object",
          properties: {
            callSign: { type: "string" },
            state: {
              type: "string",
              enum: ["available", "dispatched", "on-scene", "transporting", "at-hospital", "returning", "out-of-service"],
            },
          },
          required: ["callSign", "state"],
        },
      },
    },
    handler: ({ callSign, state }) => {
      const a = findAmbulanceByCallSign(String(callSign));
      if (!a) return { ok: false, message: `Ambulancia "${callSign}" no encontrada.` };
      useSanitarioStore.getState().setAmbulanceState(a.id, state as AmbulanceState);
      return { ok: true, message: `${a.callSign}: estado → ${state}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_list_victims",
        description: "Lista víctimas, opcionalmente filtradas por triaje.",
        parameters: {
          type: "object",
          properties: {
            triage: { type: "string", enum: ["red", "yellow", "green", "black"] },
          },
        },
      },
    },
    handler: ({ triage }) => {
      let list = useSanitarioStore.getState().victims;
      if (triage) list = list.filter((v) => v.triage === triage);
      if (!list.length) return { ok: true, message: "Sin víctimas que cumplan el filtro." };
      const lines = list
        .slice(0, 25)
        .map((v) => `· ${v.code} · ${v.triage.toUpperCase()} · ${v.status}`);
      return { ok: true, message: `${list.length} víctima(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_list_ambulances",
        description: "Lista ambulancias y su estado actual.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useSanitarioStore.getState().ambulances;
      const lines = list.map((a) => `· ${a.callSign} · ${a.state}`);
      return { ok: true, message: `${list.length} ambulancia(s):\n${lines.join("\n")}`, data: list };
    },
  },

  // ═══════════ LOGÍSTICA ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_create_supply",
        description: "Crea un nuevo recurso en el inventario.",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["water", "food", "medical", "fuel", "ppe", "tools", "other"] },
            name: { type: "string" },
            unit: { type: "string", enum: ["L", "kg", "t", "ud", "m", "pack"] },
            stock: { type: "number" },
            minStock: { type: "number" },
            location: { type: "string" },
          },
          required: ["category", "name", "unit", "stock", "minStock", "location"],
        },
      },
    },
    handler: ({ category, name, unit, stock, minStock, location }) => {
      useLogisticaStore.getState().upsertSupply({
        category: category as SupplyCategory,
        name: String(name),
        unit: String(unit),
        stock: Number(stock),
        minStock: Number(minStock),
        location: String(location),
      });
      return { ok: true, message: `Recurso "${name}" añadido (${stock} ${unit} en ${location}).` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_adjust_stock",
        description: "Suma o resta stock a un recurso existente (delta puede ser negativo).",
        parameters: {
          type: "object",
          properties: {
            supplyName: { type: "string" },
            delta: { type: "number" },
          },
          required: ["supplyName", "delta"],
        },
      },
    },
    handler: ({ supplyName, delta }) => {
      const s = findSupplyByName(String(supplyName));
      if (!s) return { ok: false, message: `Recurso "${supplyName}" no encontrado.` };
      useLogisticaStore.getState().adjustStock(s.id, Number(delta));
      return { ok: true, message: `${s.name}: ${Number(delta) >= 0 ? "+" : ""}${delta} ${s.unit}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_create_request",
        description: "Crea una solicitud logística (petición de recursos).",
        parameters: {
          type: "object",
          properties: {
            requestedBy: { type: "string" },
            itemName: { type: "string" },
            quantity: { type: "number" },
            unit: { type: "string" },
            priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
            destination: { type: "string" },
            category: {
              type: "string",
              enum: ["water", "food", "medical", "fuel", "ppe", "tools", "other", "vehicle", "machinery", "personnel"],
            },
            notes: { type: "string" },
          },
          required: ["requestedBy", "itemName", "quantity", "unit", "priority", "destination", "category"],
        },
      },
    },
    handler: ({ requestedBy, itemName, quantity, unit, priority, destination, category, notes }) => {
      useLogisticaStore.getState().createRequest({
        emergencyId: "emg-001",
        requestedBy: String(requestedBy),
        itemName: String(itemName),
        quantity: Number(quantity),
        unit: String(unit),
        priority: priority as LogisticsRequestPriority,
        destination: String(destination),
        category: category as SupplyCategory | "vehicle" | "machinery" | "personnel",
        notes: notes ? String(notes) : undefined,
      });
      return { ok: true, message: `Solicitud creada: ${quantity} ${unit} de ${itemName} → ${destination}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_decide_request",
        description: "Aprueba, rechaza, marca en tránsito o entregada una solicitud logística.",
        parameters: {
          type: "object",
          properties: {
            requestRef: { type: "string", description: "Nombre del item o ID de la solicitud." },
            status: { type: "string", enum: ["approved", "denied", "in-transit", "delivered"] },
          },
          required: ["requestRef", "status"],
        },
      },
    },
    handler: ({ requestRef, status }) => {
      const r = findRequestByItem(String(requestRef));
      if (!r) return { ok: false, message: `Solicitud "${requestRef}" no encontrada.` };
      useLogisticaStore.getState().decideRequest(r.id, status as LogisticsRequestStatus);
      return { ok: true, message: `Solicitud "${r.itemName}" → ${status}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_set_vehicle_state",
        description: "Cambia el estado de un vehículo por indicativo.",
        parameters: {
          type: "object",
          properties: {
            callSign: { type: "string" },
            state: { type: "string", enum: ["available", "deployed", "maintenance", "out-of-service"] },
          },
          required: ["callSign", "state"],
        },
      },
    },
    handler: ({ callSign, state }) => {
      const v = findVehicleByCallSign(String(callSign));
      if (!v) return { ok: false, message: `Vehículo "${callSign}" no encontrado.` };
      useLogisticaStore.getState().setVehicleState(v.id, state as VehicleState);
      return { ok: true, message: `${v.callSign}: estado → ${state}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_set_service_status",
        description: "Cambia el estado de un servicio (agua/luz/gas/telecom/saneamiento) en una zona.",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["water", "electricity", "gas", "telecom", "sewer"] },
            status: { type: "string", enum: ["operational", "degraded", "outage", "restoring"] },
            area: { type: "string", description: "Zona afectada (opcional)." },
          },
          required: ["kind", "status"],
        },
      },
    },
    handler: ({ kind, status, area }) => {
      const s = findServiceByKindArea(String(kind), area ? String(area) : undefined);
      if (!s) return { ok: false, message: `Servicio "${kind}"${area ? ` en "${area}"` : ""} no encontrado.` };
      useLogisticaStore.getState().setServiceStatus(s.id, status as ServiceStatus);
      return { ok: true, message: `Servicio ${kind} en ${s.area}: ${status}.` };
    },
  },

  // ═══════════ GABINETE ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "gabinete_set_channel_status",
        description: "Activa o desactiva un canal de comunicación por nombre.",
        parameters: {
          type: "object",
          properties: {
            channelName: { type: "string" },
            status: { type: "string", enum: ["online", "degraded", "offline"] },
          },
          required: ["channelName", "status"],
        },
      },
    },
    handler: ({ channelName, status }) => {
      const c = findChannelByName(String(channelName));
      if (!c) return { ok: false, message: `Canal "${channelName}" no encontrado.` };
      useGabineteStore.getState().setChannelStatus(c.id, status as ChannelStatus);
      return { ok: true, message: `Canal ${channelLabel(c.kind)} → ${status}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "gabinete_publish_communique",
        description: "Publica un comunicado en un canal (busca ambos por título/nombre).",
        parameters: {
          type: "object",
          properties: {
            communiqueTitle: { type: "string" },
            channelName: { type: "string" },
            reach: { type: "number", description: "Alcance estimado (opcional)." },
          },
          required: ["communiqueTitle", "channelName"],
        },
      },
    },
    handler: ({ communiqueTitle, channelName, reach }) => {
      const com = findCommuniqueByTitle(String(communiqueTitle));
      const ch = findChannelByName(String(channelName));
      if (!com) return { ok: false, message: `Comunicado "${communiqueTitle}" no encontrado.` };
      if (!ch) return { ok: false, message: `Canal "${channelName}" no encontrado.` };
      useGabineteStore.getState().publishToChannel(com.id, ch.id, reach ? Number(reach) : undefined);
      return { ok: true, message: `Publicado "${com.title}" en ${channelLabel(ch.kind)}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "gabinete_retract_publication",
        description: "Retracta una publicación existente.",
        parameters: {
          type: "object",
          properties: {
            communiqueTitle: { type: "string" },
            channelName: { type: "string" },
          },
          required: ["communiqueTitle", "channelName"],
        },
      },
    },
    handler: ({ communiqueTitle, channelName }) => {
      const com = findCommuniqueByTitle(String(communiqueTitle));
      const ch = findChannelByName(String(channelName));
      if (!com || !ch) return { ok: false, message: `No se encontró la combinación comunicado/canal.` };
      useGabineteStore.getState().retractPublication(com.id, ch.id);
      return { ok: true, message: `Retractada publicación "${com.title}" en ${channelLabel(ch.kind)}.` };
    },
  },

  // ═══════════ DIRECCIÓN ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_set_level",
        description: "Cambia el nivel operacional del plan de emergencia (1, 2 o 3).",
        parameters: {
          type: "object",
          properties: {
            level: { type: "number", enum: [1, 2, 3] },
            notes: { type: "string" },
          },
          required: ["level"],
        },
      },
    },
    handler: ({ level, notes }) => {
      useDireccionStore.getState().setLevel(Number(level) as OperationalLevel, "Centro IA", notes ? String(notes) : undefined);
      return { ok: true, message: `Nivel operacional → ${level}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_activate",
        description: "Activa el plan de emergencia (marca timestamp de activación).",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      useDireccionStore.getState().activate("Centro IA");
      return { ok: true, message: "Plan de emergencia activado." };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_close",
        description: "Cierra el plan de emergencia.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      useDireccionStore.getState().close("Centro IA");
      return { ok: true, message: "Plan de emergencia cerrado." };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_decide_media_request",
        description: "Aprueba o rechaza una solicitud de medios de comunicación.",
        parameters: {
          type: "object",
          properties: {
            ref: { type: "string", description: "Outlet o tema de la solicitud." },
            status: { type: "string", enum: ["approved", "denied", "delivered"] },
          },
          required: ["ref", "status"],
        },
      },
    },
    handler: ({ ref, status }) => {
      const m = findMediaRequestByRef(String(ref));
      if (!m) return { ok: false, message: `Solicitud de medios "${ref}" no encontrada.` };
      useDireccionStore.getState().decideMediaRequest(m.id, status as MediaRequestStatus, "Centro IA");
      return { ok: true, message: `Solicitud "${m.requestedBy} · ${m.reason}" → ${status}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_set_communique_status",
        description: "Cambia el estado de un comunicado (draft → pending-approval → approved → sent).",
        parameters: {
          type: "object",
          properties: {
            communiqueTitle: { type: "string" },
            status: { type: "string", enum: ["draft", "pending-approval", "approved", "sent"] },
          },
          required: ["communiqueTitle", "status"],
        },
      },
    },
    handler: ({ communiqueTitle, status }) => {
      const c = findCommuniqueByTitle(String(communiqueTitle));
      if (!c) return { ok: false, message: `Comunicado "${communiqueTitle}" no encontrado.` };
      useDireccionStore
        .getState()
        .setCommuniqueStatus(c.id, status as CommuniqueStatus, "Centro IA");
      return { ok: true, message: `Comunicado "${c.title}" → ${status}.` };
    },
  },

  // ═══════════ CAMPO ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "campo_add_report",
        description: "Añade un reporte de campo (texto + tipo).",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["support", "checkpoint", "incident", "voice", "image"] },
            title: { type: "string" },
            body: { type: "string" },
          },
          required: ["kind", "title", "body"],
        },
      },
    },
    handler: ({ kind, title, body }) => {
      useCampoStore.getState().addReport({
        kind: kind as "support" | "checkpoint" | "incident" | "voice" | "image",
        title: String(title),
        body: String(body),
      });
      return { ok: true, message: `Reporte añadido: "${title}".` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "campo_request_support",
        description: "La unidad de campo solicita apoyo (opcionalmente con notas).",
        parameters: {
          type: "object",
          properties: {
            notes: { type: "string" },
          },
        },
      },
    },
    handler: ({ notes }) => {
      useCampoStore.getState().requestSupport(notes ? String(notes) : undefined);
      return { ok: true, message: "Apoyo solicitado por la unidad de campo." };
    },
  },

  // ═══════════════════════════════════════════════════
  // CONSULTAS DE ESTADO (read-only) — la IA puede informar
  // ═══════════════════════════════════════════════════

  // ───── DIRECCIÓN ─────
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_shelters",
        description: "Lista los albergues / centros de acogida con su ocupación, capacidad, estado y dotaciones.",
        parameters: {
          type: "object",
          properties: {
            onlyFull: { type: "boolean", description: "Solo mostrar los que están al >80% de capacidad." },
          },
        },
      },
    },
    handler: ({ onlyFull }) => {
      let list = useDireccionStore.getState().shelters;
      if (onlyFull) list = list.filter((s) => s.capacity > 0 && s.occupancy / s.capacity > 0.8);
      if (!list.length) return { ok: true, message: "Sin albergues que mostrar." };
      const lines = list.map((s) => {
        const pct = s.capacity ? Math.round((s.occupancy / s.capacity) * 100) : 0;
        const fac = s.facilities?.length ? ` · ${s.facilities.join("/")}` : "";
        const cont = s.contact ? ` · ${s.contact}` : "";
        return `· ${s.name} — ${s.occupancy}/${s.capacity} (${pct}%) · ${s.state}${fac}${cont}`;
      });
      const totalCap = list.reduce((a, s) => a + s.capacity, 0);
      const totalOcc = list.reduce((a, s) => a + s.occupancy, 0);
      return {
        ok: true,
        message: `${list.length} albergue(s) · ${totalOcc}/${totalCap} plazas (${totalCap ? Math.round((totalOcc / totalCap) * 100) : 0}%):\n${lines.join("\n")}`,
        data: list,
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_get_status",
        description: "Estado general del plan de emergencia: nivel operacional, activación, cierre.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const s = useDireccionStore.getState();
      const parts = [
        `Nivel: ${s.level}`,
        s.activatedAt ? `Activado: ${new Date(s.activatedAt).toLocaleString("es-ES")}` : "Sin activar",
        s.closedAt ? `Cerrado: ${new Date(s.closedAt).toLocaleString("es-ES")}` : "Abierto",
      ];
      return { ok: true, message: `Plan: ${parts.join(" · ")}.` };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_groups",
        description: "Lista los grupos operacionales (Sanitario, Seguridad, Logístico, Acción Social, etc.) con estado, dotación y último parte.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const groups = useDireccionStore.getState().groups;
      const lines = groups.map(
        (g) =>
          `· ${g.type.toUpperCase()} · ${g.state} · ${g.membersActive}/${g.membersTotal} efectivos · lidera ${g.leader}`,
      );
      return { ok: true, message: `${groups.length} grupo(s):\n${lines.join("\n")}`, data: groups };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_communiques",
        description: "Lista los comunicados con su estado (draft, pending-approval, approved, sent).",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["draft", "pending-approval", "approved", "sent"] },
          },
        },
      },
    },
    handler: ({ status }) => {
      let list = useDireccionStore.getState().communiques;
      if (status) list = list.filter((c) => c.status === status);
      if (!list.length) return { ok: true, message: "Sin comunicados que mostrar." };
      const lines = list.map((c) => `· "${c.title}" · ${c.status} · audiencia ${c.audience}`);
      return { ok: true, message: `${list.length} comunicado(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_media_requests",
        description: "Lista las solicitudes de medios pendientes/decididas.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "denied", "delivered"] },
          },
        },
      },
    },
    handler: ({ status }) => {
      let list = useDireccionStore.getState().mediaRequests;
      if (status) list = list.filter((m) => m.status === status);
      if (!list.length) return { ok: true, message: "Sin solicitudes." };
      const lines = list.map(
        (m) =>
          `· ${m.requestedBy} pide ${m.quantity}× ${m.resourceType} (${m.priority}) · ${m.status} · "${m.reason}"`,
      );
      return { ok: true, message: `${list.length} solicitud(es):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_evacuations",
        description: "Lista las evacuaciones en curso/completadas con personas evacuadas y destino.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useDireccionStore.getState().evacuations;
      const shelters = useDireccionStore.getState().shelters;
      if (!list.length) return { ok: true, message: "Sin evacuaciones registradas." };
      const lines = list.map((e) => {
        const sh = shelters.find((s) => s.id === e.toShelterId)?.name ?? "?";
        return `· ${e.name} → ${sh} · ${e.evacuatedPeople}/${e.estimatedPeople} pers. · ${e.status}`;
      });
      return { ok: true, message: `${list.length} evacuación(es):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "direccion_list_command_posts",
        description: "Lista los puestos de mando (PMA, CECOPAL, CECOP) con su responsable y grupos asignados.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useDireccionStore.getState().commandPosts;
      if (!list.length) return { ok: true, message: "Sin puestos de mando." };
      const lines = list.map(
        (c) => `· ${c.code} (${c.type}) · ${c.state} · ${c.commanderName} · grupos: ${c.groups.join(", ")}`,
      );
      return { ok: true, message: `${list.length} puesto(s) de mando:\n${lines.join("\n")}`, data: list };
    },
  },

  // ───── SEGURIDAD ─────
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_list_perimeters",
        description: "Lista los perímetros de seguridad (activos o levantados).",
        parameters: {
          type: "object",
          properties: {
            onlyActive: { type: "boolean", description: "Solo perímetros activos." },
          },
        },
      },
    },
    handler: ({ onlyActive }) => {
      let list = useSeguridadStore.getState().perimeters;
      if (onlyActive) list = list.filter((p) => p.status === "active");
      if (!list.length) return { ok: true, message: "Sin perímetros que mostrar." };
      const lines = list.map((p) => {
        const geom =
          p.shape === "circle" && p.radius
            ? `radio ${Math.round(p.radius)} m`
            : `${p.points.length} puntos`;
        return `· "${p.label}" · ${p.kind} · nivel ${p.level} · ${p.status} · ${geom}`;
      });
      return { ok: true, message: `${list.length} perímetro(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_list_checkpoints",
        description: "Lista los controles de acceso (checkpoints) con su estado y dotación.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useSeguridadStore.getState().accessControls;
      if (!list.length) return { ok: true, message: "Sin controles desplegados." };
      const lines = list.map(
        (a) => `· "${a.label}" · ${a.kind} · ${a.state}${a.units ? ` · ${a.units} efectivos` : ""}`,
      );
      return { ok: true, message: `${list.length} control(es):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "seguridad_list_activities",
        description: "Últimas actividades del grupo de seguridad (cierres, controles, evacuaciones, incidentes).",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Máx. de líneas (default 10)." },
          },
        },
      },
    },
    handler: ({ limit }) => {
      const n = limit != null ? Number(limit) : 10;
      const list = useSeguridadStore.getState().activities.slice(0, n);
      if (!list.length) return { ok: true, message: "Sin actividad de seguridad reciente." };
      const lines = list.map(
        (a) => `· ${new Date(a.timestamp).toLocaleTimeString("es-ES")} · ${a.message}`,
      );
      return { ok: true, message: lines.join("\n"), data: list };
    },
  },

  // ───── SANITARIO ─────
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_list_hospitals",
        description: "Lista hospitales: nivel, camas, saturación por triaje (rojo/amarillo/verde), quirófanos, estado.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useSanitarioStore.getState().hospitals;
      if (!list.length) return { ok: true, message: "Sin hospitales registrados." };
      const lines = list.map((h) => {
        return `· ${h.name} (N${h.level}) · camas ${h.beds.available}/${h.beds.total} · R ${h.red.current}/${h.red.capacity} · A ${h.yellow.current}/${h.yellow.capacity} · V ${h.green.current}/${h.green.capacity} · quir. ${h.surgeryRooms.available}/${h.surgeryRooms.total} · ${h.state}`;
      });
      return { ok: true, message: `${list.length} hospital(es):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_list_zones",
        description: "Lista las zonas sanitarias (triage points, first-aid, zone) con capacidad y ocupación.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useSanitarioStore.getState().zones;
      if (!list.length) return { ok: true, message: "Sin zonas sanitarias instaladas." };
      const lines = list.map(
        (z) => `· "${z.label}" · ${z.kind} · ${z.current}/${z.capacity} · ${z.state}`,
      );
      return { ok: true, message: `${list.length} zona(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "sanitario_list_alerts",
        description: "Alertas sanitarias (críticas/altas/medias). Por defecto solo las no reconocidas.",
        parameters: {
          type: "object",
          properties: {
            includeAcknowledged: { type: "boolean" },
          },
        },
      },
    },
    handler: ({ includeAcknowledged }) => {
      let list = useSanitarioStore.getState().alerts;
      if (!includeAcknowledged) list = list.filter((a) => !a.acknowledged);
      if (!list.length) return { ok: true, message: "Sin alertas sanitarias." };
      const lines = list.map(
        (a) => `· [${a.severity.toUpperCase()}] ${a.source}: ${a.message}`,
      );
      return { ok: true, message: `${list.length} alerta(s):\n${lines.join("\n")}`, data: list };
    },
  },

  // ───── LOGÍSTICA ─────
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_list_supplies",
        description: "Lista el inventario de recursos. Filtros opcionales por categoría o estado (ok/low/critical/out).",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["water", "food", "medical", "fuel", "ppe", "tools", "other"] },
            state: { type: "string", enum: ["ok", "low", "critical", "out"] },
          },
        },
      },
    },
    handler: ({ category, state }) => {
      let list = useLogisticaStore.getState().supplies;
      if (category) list = list.filter((s) => s.category === category);
      if (state) list = list.filter((s) => s.state === state);
      if (!list.length) return { ok: true, message: "Sin recursos que cumplan el filtro." };
      const lines = list
        .slice(0, 30)
        .map((s) => `· ${s.name} (${s.category}) · ${s.stock}/${s.minStock} ${s.unit} · ${s.state} · ${s.location}`);
      return { ok: true, message: `${list.length} recurso(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_critical_supplies",
        description: "Recursos críticos o agotados que requieren reposición inmediata.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useLogisticaStore
        .getState()
        .supplies.filter((s) => s.state === "critical" || s.state === "out");
      if (!list.length) return { ok: true, message: "Sin recursos críticos. Inventario estable." };
      const lines = list.map(
        (s) => `· ${s.name} · ${s.stock}/${s.minStock} ${s.unit} · ${s.state.toUpperCase()} · ${s.location}`,
      );
      return { ok: true, message: `${list.length} recurso(s) crítico(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_list_vehicles",
        description: "Lista vehículos logísticos con estado, combustible y conductor.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useLogisticaStore.getState().vehicles;
      const lines = list.map(
        (v) => `· ${v.callSign} (${v.kind}) · ${v.state} · ${v.fuelPct}% combustible · ${v.driver ?? "sin conductor"} · ${v.location}`,
      );
      return { ok: true, message: `${list.length} vehículo(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_list_machinery",
        description: "Lista maquinaria (generadores, bombas, grúas, etc.) con estado y ubicación.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useLogisticaStore.getState().machinery;
      if (!list.length) return { ok: true, message: "Sin maquinaria registrada." };
      const lines = list.map(
        (m) => `· ${m.callSign} (${m.kind}) · ${m.state} · ${m.location}`,
      );
      return { ok: true, message: `${list.length} maquinaria:\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_list_services",
        description: "Servicios afectados (agua, electricidad, gas, telefonía, saneamiento) con estado y población afectada.",
        parameters: {
          type: "object",
          properties: {
            onlyAffected: { type: "boolean", description: "Solo los que no están operativos." },
          },
        },
      },
    },
    handler: ({ onlyAffected }) => {
      let list = useLogisticaStore.getState().services;
      if (onlyAffected) list = list.filter((s) => s.status !== "operational");
      if (!list.length) return { ok: true, message: "Sin servicios afectados." };
      const lines = list.map(
        (s) => `· ${s.kind.toUpperCase()} en ${s.area} · ${s.status} · ${s.affectedPopulation.toLocaleString("es-ES")} hab. · ${s.provider}`,
      );
      return { ok: true, message: `${list.length} servicio(s):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "logistica_list_requests",
        description: "Lista las solicitudes logísticas con filtro opcional por estado.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "approved", "in-transit", "delivered", "denied"] },
          },
        },
      },
    },
    handler: ({ status }) => {
      let list = useLogisticaStore.getState().requests;
      if (status) list = list.filter((r) => r.status === status);
      if (!list.length) return { ok: true, message: "Sin solicitudes." };
      const lines = list
        .slice(0, 25)
        .map(
          (r) =>
            `· ${r.quantity} ${r.unit} de ${r.itemName} → ${r.destination} · ${r.priority} · ${r.status}`,
        );
      return { ok: true, message: `${list.length} solicitud(es):\n${lines.join("\n")}`, data: list };
    },
  },

  // ───── GABINETE ─────
  {
    definition: {
      type: "function",
      function: {
        name: "gabinete_list_channels",
        description: "Lista los canales de comunicación con su estado y alcance estimado.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const list = useGabineteStore.getState().channels;
      if (!list.length) return { ok: true, message: "Sin canales configurados." };
      const lines = list.map(
        (c) =>
          `· ${channelLabel(c.kind)} · ${c.status}${c.audienceReach ? ` · ${c.audienceReach.toLocaleString("es-ES")} alcance` : ""}`,
      );
      return { ok: true, message: `${list.length} canal(es):\n${lines.join("\n")}`, data: list };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "gabinete_list_publications",
        description: "Publicaciones recientes (qué comunicado se ha publicado en qué canal y cuándo).",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const pubs = useGabineteStore.getState().publications;
      const coms = useDireccionStore.getState().communiques;
      const chs = useGabineteStore.getState().channels;
      if (!pubs.length) return { ok: true, message: "Sin publicaciones." };
      const lines = pubs.map((p) => {
        const t = coms.find((c) => c.id === p.communiqueId)?.title ?? p.communiqueId;
        const ch = chs.find((c) => c.id === p.channelId);
        const chLbl = ch ? channelLabel(ch.kind) : p.channelId;
        const when = p.publishedAt ? new Date(p.publishedAt).toLocaleString("es-ES") : "—";
        return `· "${t}" → ${chLbl} · ${p.status} · ${when}`;
      });
      return { ok: true, message: `${pubs.length} publicación(es):\n${lines.join("\n")}`, data: pubs };
    },
  },

  // ───── CAMPO ─────
  {
    definition: {
      type: "function",
      function: {
        name: "campo_get_unit_status",
        description: "Estado de la unidad de campo: indicativo, estado, ubicación, batería, tarea activa.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const s = useCampoStore.getState();
      const u = s.unit;
      const t = s.tasks.find((x) => x.id === u.activeTaskId);
      const parts = [
        `${u.callSign} (${u.operator})`,
        `Estado: ${u.state}`,
        `Batería: ${u.battery}%`,
        `Ubicación: ${u.location.lat.toFixed(4)}, ${u.location.lng.toFixed(4)}`,
        t ? `Tarea activa: ${t.id} · ${t.status}` : "Sin tarea activa",
      ];
      return { ok: true, message: parts.join(" · "), data: u };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "campo_list_reports",
        description: "Últimos reportes enviados por la unidad de campo.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number" },
            kind: { type: "string", enum: ["incident", "voice", "image", "checkpoint", "support"] },
          },
        },
      },
    },
    handler: ({ limit, kind }) => {
      let list = useCampoStore.getState().reports;
      if (kind) list = list.filter((r) => r.kind === kind);
      const n = limit != null ? Number(limit) : 10;
      list = list.slice(0, n);
      if (!list.length) return { ok: true, message: "Sin reportes." };
      const lines = list.map(
        (r) => `· [${r.kind}] ${r.title} — ${new Date(r.createdAt).toLocaleString("es-ES")}`,
      );
      return { ok: true, message: lines.join("\n"), data: list };
    },
  },

  // ───── PLAN MUNICIPAL DE EMERGENCIAS (RAG document-grounded) ─────
  // Única herramienta de consulta documental. Lee del índice vectorial
  // (IndexedDB local) y devuelve hasta 5 fragmentos del Plan con metadata
  // suficiente para citar al operador (chunk_id, sección, página, score).
  // Si no hay índice o ningún fragmento supera el umbral de similitud,
  // devuelve un RAG_STATUS distinto a `ok` y el LLM DEBE rechazar.
  {
    definition: {
      type: "function",
      function: {
        name: "rag_query",
        description:
          "Recupera fragmentos del Plan Municipal de Emergencias indexado (búsqueda semántica). ÚSALA SIEMPRE como única fuente para cualquier pregunta sobre el Plan: riesgos, estructura, fases, protocolos, evacuación, confinamiento, recomendaciones, directorio, anexos. NO respondas de memoria sobre el Plan: llama a esta tool y cita los fragmentos. Si la respuesta es RAG_STATUS distinto de `ok`, responde literalmente que la información no está disponible en el Plan.",
        parameters: {
          type: "object",
          properties: {
            consulta: {
              type: "string",
              description:
                "Pregunta literal o reformulada del operador. Cuanto más específica, mejor (incluye términos clave del Plan: 'confinamiento', 'situación 1', 'CECOPAL', etc.).",
            },
            top_k: {
              type: "integer",
              description: "Fragmentos a devolver. Por defecto 5; usa 3 para preguntas muy puntuales, 8 si la consulta es compleja.",
            },
          },
          required: ["consulta"],
        },
      },
    },
    handler: async ({ consulta, top_k }) => {
      const q = String(consulta ?? "").trim();
      if (!q) return { ok: false, message: "Indica qué quieres consultar del Plan." };
      const k = typeof top_k === "number" && top_k > 0 && top_k <= 10 ? top_k : undefined;
      const decision = await ragQuery(q, k ? { topK: k } : {});
      const message = formatDecisionForLLM(decision);
      return {
        ok: decision.ok,
        message,
        data: decision,
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "rag_documentos_disponibles",
        description:
          "Lista los Planes Municipales actualmente indexados en el sistema (título, nº de fragmentos, origen). Úsalo solo si el operador pregunta qué documentos están cargados o por qué no hay respuesta.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: async () => {
      const docs = await listIngestedDocs();
      if (docs.length === 0) {
        return {
          ok: false,
          message:
            "No hay ningún Plan indexado todavía. El sistema indexa el PLATERMU al abrir el Centro Operativo; espera unos segundos o pide al operador que cargue un PDF.",
        };
      }
      const lines = docs.map(
        (d) =>
          `· ${d.title} (${d.source === "embedded" ? "empaquetado" : "subido"}): ${d.chunkCount} fragmentos, indexado ${new Date(d.indexedAt).toLocaleString("es-ES")}.`,
      );
      return { ok: true, message: lines.join("\n"), data: docs };
    },
  },

  // ═══════════ MAPA / CONSCIENCIA GEOESPACIAL ═══════════
  {
    definition: {
      type: "function",
      function: {
        name: "map_get_emergency",
        description: "Devuelve los datos de la emergencia activa: código, nombre, dominio, severidad, estado, momento de inicio, coordenadas exactas del origen (lat/lng), polígono del área afectada y población afectada. Úsalo cuando el operador hable del 'origen', 'inicio', 'epicentro' o 'foco' de la emergencia, o cuando necesites coordenadas para crear algo cerca.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const em = selectActiveEmergency(useEmergencyStore.getState());
      if (!em) return { ok: false, message: "No hay ninguna emergencia activa." };
      const line = `${em.code} · ${em.name} · ${em.domain} · severidad ${em.severity} · ${em.status} · iniciada ${new Date(em.startedAt).toLocaleString("es-ES")} · origen ${em.location.lat.toFixed(5)},${em.location.lng.toFixed(5)} · población afectada ${em.affectedPopulation}.`;
      return {
        ok: true,
        message: line,
        data: {
          id: em.id,
          code: em.code,
          name: em.name,
          domain: em.domain,
          severity: em.severity,
          status: em.status,
          startedAt: em.startedAt,
          origin: { lat: em.location.lat, lng: em.location.lng },
          area: em.area,
          affectedPopulation: em.affectedPopulation,
          description: em.description,
          commandPost: em.commandPost,
        },
      };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "map_list_points",
        description: "Lista TODO lo geolocalizado actualmente en el mapa con sus coordenadas (lat/lng) e identificador amigable. Útil para que sepas qué hay desplegado antes de crear algo, o para responder preguntas tipo 'qué tengo cerca de X'. Puedes filtrar por categorías.",
        parameters: {
          type: "object",
          properties: {
            categories: {
              type: "array",
              description: "Opcional. Categorías a incluir. Si se omite, devuelve todas.",
              items: {
                type: "string",
                enum: [
                  "emergency",
                  "victims",
                  "ambulances",
                  "hospitals",
                  "sanitary_zones",
                  "perimeters",
                  "closures",
                  "checkpoints",
                  "command_posts",
                  "shelters",
                  "vehicles",
                  "field_reports",
                ],
              },
            },
          },
        },
      },
    },
    handler: ({ categories }) => {
      const wanted = new Set(
        Array.isArray(categories) && categories.length
          ? categories.map((c) => String(c))
          : [
              "emergency",
              "victims",
              "ambulances",
              "hospitals",
              "sanitary_zones",
              "perimeters",
              "closures",
              "checkpoints",
              "command_posts",
              "shelters",
              "vehicles",
              "field_reports",
            ],
      );
      const em = selectActiveEmergency(useEmergencyStore.getState());
      const seg = useSeguridadStore.getState();
      const san = useSanitarioStore.getState();
      const dir = useDireccionStore.getState();
      const log = useLogisticaStore.getState();
      const camp = useCampoStore.getState();
      const fmt = (p: GeoPoint) => ({ lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) });
      const out: Record<string, unknown> = {};
      if (wanted.has("emergency") && em) {
        out.emergency = { code: em.code, name: em.name, ...fmt(em.location) };
      }
      if (wanted.has("victims")) {
        out.victims = san.victims.map((v) => ({
          code: v.code,
          triage: v.triage,
          status: v.status,
          ...fmt(v.location),
        }));
      }
      if (wanted.has("ambulances")) {
        out.ambulances = san.ambulances.map((a) => ({
          callSign: a.callSign,
          kind: a.kind,
          state: a.state,
          ...fmt(a.location),
        }));
      }
      if (wanted.has("hospitals")) {
        out.hospitals = san.hospitals.map((h) => ({
          name: h.name,
          level: h.level,
          state: h.state,
          ...fmt(h.location),
        }));
      }
      if (wanted.has("sanitary_zones")) {
        out.sanitary_zones = san.zones.map((z) => ({
          label: z.label,
          kind: z.kind,
          state: z.state,
          ...fmt(z.location),
        }));
      }
      if (wanted.has("perimeters")) {
        out.perimeters = seg.perimeters.map((p) => {
          const center =
            p.center ??
            (p.points.length
              ? {
                  lat: p.points.reduce((s, q) => s + q.lat, 0) / p.points.length,
                  lng: p.points.reduce((s, q) => s + q.lng, 0) / p.points.length,
                }
              : { lat: 0, lng: 0 });
          return {
            label: p.label,
            kind: p.kind,
            level: p.level,
            status: p.status,
            ...fmt(center),
          };
        });
      }
      if (wanted.has("closures")) {
        out.closures = seg.closures.map((c) => ({
          road: c.road,
          km: c.km,
          status: c.status,
          ...fmt(c.location),
        }));
      }
      if (wanted.has("checkpoints")) {
        out.checkpoints = seg.accessControls.map((a) => ({
          label: a.label,
          kind: a.kind,
          state: a.state,
          ...fmt(a.location),
        }));
      }
      if (wanted.has("command_posts")) {
        out.command_posts = dir.commandPosts.map((cp) => ({
          code: cp.code,
          type: cp.type,
          state: cp.state,
          ...fmt(cp.location),
        }));
      }
      if (wanted.has("shelters")) {
        out.shelters = dir.shelters.map((s) => ({
          name: s.name,
          capacity: s.capacity,
          occupancy: s.occupancy,
          state: s.state,
          ...fmt(s.location),
        }));
      }
      if (wanted.has("vehicles")) {
        out.vehicles = log.vehicles
          .filter((v) => v.location && typeof (v.location as unknown as GeoPoint).lat === "number")
          .map((v) => ({
            callSign: v.callSign,
            kind: v.kind,
            state: v.state,
            ...fmt(v.location as unknown as GeoPoint),
          }));
      }
      if (wanted.has("field_reports")) {
        out.field_reports = camp.reports
          .filter((r) => r.location)
          .map((r) => ({
            id: r.id,
            kind: r.kind,
            title: r.title,
            ...fmt(r.location as GeoPoint),
          }));
      }
      const counts = Object.entries(out)
        .filter(([k]) => k !== "emergency")
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : 1}`)
        .join(" · ");
      return { ok: true, message: counts || "Mapa vacío.", data: out };
    },
  },
  {
    definition: {
      type: "function",
      function: {
        name: "map_nearby",
        description: "Lista entidades del mapa cercanas a un punto de referencia, ordenadas por distancia. Útil para 'qué hay cerca del origen de la emergencia' o 'qué unidades tengo a menos de 500m de VIC-003'. El punto se especifica con lat/lng o con un identificador amigable: 'emergency' (origen de la emergencia), un código de víctima (VIC-XXX), un indicativo de ambulancia (AMB-XX) o un indicativo de vehículo.",
        parameters: {
          type: "object",
          properties: {
            ref: { type: "string", description: "Identificador amigable del punto de referencia: 'emergency', 'VIC-003', 'AMB-04', etc. Alternativa a lat/lng." },
            lat: { type: "number", description: "Latitud del punto de referencia (alternativa a ref)." },
            lng: { type: "number", description: "Longitud del punto de referencia (alternativa a ref)." },
            radiusMeters: { type: "number", description: "Radio de búsqueda en metros. Por defecto 500." },
            categories: {
              type: "array",
              description: "Categorías a incluir. Si se omite, todas excepto la propia 'emergency'.",
              items: {
                type: "string",
                enum: ["victims", "ambulances", "hospitals", "sanitary_zones", "perimeters", "closures", "checkpoints", "command_posts", "shelters", "vehicles", "field_reports"],
              },
            },
          },
        },
      },
    },
    handler: ({ ref, lat, lng, radiusMeters, categories }) => {
      let origin: GeoPoint | null = null;
      let originLabel = "";
      if (typeof lat === "number" && typeof lng === "number") {
        origin = { lat: Number(lat), lng: Number(lng) };
        originLabel = `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`;
      } else if (ref) {
        const r = String(ref).trim();
        if (lc(r) === "emergency" || lc(r) === "emergencia" || lc(r) === "origen") {
          const em = selectActiveEmergency(useEmergencyStore.getState());
          if (em) {
            origin = em.location;
            originLabel = `origen ${em.code}`;
          }
        } else {
          const v = findVictimByCode(r);
          if (v) {
            origin = v.location;
            originLabel = v.code;
          } else {
            const a = findAmbulanceByCallSign(r);
            if (a) {
              origin = a.location;
              originLabel = a.callSign;
            } else {
              const veh = findVehicleByCallSign(r);
              if (veh && veh.location) {
                origin = veh.location as unknown as GeoPoint;
                originLabel = veh.callSign;
              }
            }
          }
        }
      }
      if (!origin) {
        return { ok: false, message: "No se pudo resolver el punto de referencia. Pasa lat/lng o un identificador válido ('emergency', VIC-XXX, AMB-XX)." };
      }
      const radius = typeof radiusMeters === "number" && radiusMeters > 0 ? Number(radiusMeters) : 500;
      const wanted = new Set(
        Array.isArray(categories) && categories.length
          ? categories.map((c) => String(c))
          : ["victims", "ambulances", "hospitals", "sanitary_zones", "perimeters", "closures", "checkpoints", "command_posts", "shelters", "vehicles", "field_reports"],
      );
      const items: { category: string; label: string; lat: number; lng: number; meters: number }[] = [];
      const push = (category: string, label: string, p: GeoPoint) => {
        const m = dist(origin!, p);
        if (m <= radius) items.push({ category, label, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), meters: Math.round(m) });
      };
      const seg = useSeguridadStore.getState();
      const san = useSanitarioStore.getState();
      const dir = useDireccionStore.getState();
      const log = useLogisticaStore.getState();
      const camp = useCampoStore.getState();
      if (wanted.has("victims")) san.victims.forEach((v) => push("victim", `${v.code} (${v.triage})`, v.location));
      if (wanted.has("ambulances")) san.ambulances.forEach((a) => push("ambulance", `${a.callSign} (${a.state})`, a.location));
      if (wanted.has("hospitals")) san.hospitals.forEach((h) => push("hospital", h.name, h.location));
      if (wanted.has("sanitary_zones")) san.zones.forEach((z) => push("zone", `${z.label} (${z.kind})`, z.location));
      if (wanted.has("perimeters")) {
        seg.perimeters.forEach((p) => {
          const c = p.center ?? (p.points.length ? { lat: p.points.reduce((s, q) => s + q.lat, 0) / p.points.length, lng: p.points.reduce((s, q) => s + q.lng, 0) / p.points.length } : null);
          if (c) push("perimeter", `${p.label} (${p.kind})`, c);
        });
      }
      if (wanted.has("closures")) seg.closures.forEach((c) => push("closure", `${c.road}${c.km ? ` km ${c.km}` : ""}`, c.location));
      if (wanted.has("checkpoints")) seg.accessControls.forEach((a) => push("checkpoint", `${a.label} (${a.state})`, a.location));
      if (wanted.has("command_posts")) dir.commandPosts.forEach((cp) => push("command_post", `${cp.code} (${cp.type})`, cp.location));
      if (wanted.has("shelters")) dir.shelters.forEach((s) => push("shelter", `${s.name} (${s.occupancy}/${s.capacity})`, s.location));
      if (wanted.has("vehicles")) {
        log.vehicles.forEach((v) => {
          const loc = v.location as unknown as GeoPoint | undefined;
          if (loc && typeof loc.lat === "number") push("vehicle", `${v.callSign} (${v.state})`, loc);
        });
      }
      if (wanted.has("field_reports")) camp.reports.forEach((r) => { if (r.location) push("field_report", `${r.kind} ${r.id}`, r.location); });
      items.sort((a, b) => a.meters - b.meters);
      const head = items.slice(0, 20);
      const msg = head.length
        ? `${head.length} entidad(es) en ${radius}m de ${originLabel}:\n` + head.map((i) => `· ${i.category} ${i.label} — ${i.meters}m`).join("\n")
        : `Nada en ${radius}m de ${originLabel}.`;
      return { ok: true, message: msg, data: { origin, radiusMeters: radius, items } };
    },
  },

  // ───── GLOBAL ─────
  {
    definition: {
      type: "function",
      function: {
        name: "global_summary",
        description: "Resumen ejecutivo del estado de la emergencia: nivel, albergues, sanitario, logística y servicios. Úsalo cuando el operador pida un resumen general o estado global.",
        parameters: { type: "object", properties: {} },
      },
    },
    handler: () => {
      const dir = useDireccionStore.getState();
      const seg = useSeguridadStore.getState();
      const san = useSanitarioStore.getState();
      const log = useLogisticaStore.getState();
      const shCap = dir.shelters.reduce((a, s) => a + s.capacity, 0);
      const shOcc = dir.shelters.reduce((a, s) => a + s.occupancy, 0);
      const closuresActive = seg.closures.filter((c) => c.status === "active").length;
      const perimsActive = seg.perimeters.filter((p) => p.status === "active").length;
      const victims = san.victims.length;
      const red = san.victims.filter((v) => v.triage === "red").length;
      const ambAvail = san.ambulances.filter((a) => a.state === "available").length;
      const critical = log.supplies.filter((s) => s.state === "critical" || s.state === "out").length;
      const svcDown = log.services.filter((s) => s.status !== "operational").length;
      const pendingReqs = log.requests.filter((r) => r.status === "pending").length;
      const lines = [
        `Plan: nivel ${dir.level}${dir.activatedAt ? ` · activo` : ` · inactivo`}.`,
        `Albergues: ${shOcc}/${shCap} (${shCap ? Math.round((shOcc / shCap) * 100) : 0}%) · ${dir.shelters.length} centros.`,
        `Seguridad: ${closuresActive} cierres activos · ${perimsActive} perímetros · ${seg.accessControls.length} controles.`,
        `Sanitario: ${victims} víctimas (${red} rojas) · ${ambAvail}/${san.ambulances.length} ambulancias disponibles · ${san.hospitals.length} hospitales.`,
        `Logística: ${critical} recursos críticos · ${pendingReqs} solicitudes pendientes · ${svcDown} servicios afectados.`,
      ];
      return { ok: true, message: lines.join("\n") };
    },
  },
];

export const TOOL_DEFINITIONS: ToolDefinition[] = TOOLS.map((t) => t.definition);

const TOOL_BY_NAME: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.definition.function.name, t]),
);

export const executeTool = async (
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  const tool = TOOL_BY_NAME[name];
  if (!tool) return { ok: false, message: `Tool "${name}" no existe.` };
  try {
    return await tool.handler(args);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
};

// ───── undo de acciones aplicadas ─────
// Revierte una acción de mapa que la IA aplicó automáticamente, eliminando
// los ids que se crearon. Devuelve un resumen para reflejar en el chat.

export const undoAppliedAction = (action: AppliedAction): { ok: boolean; message: string } => {
  try {
    const seg = useSeguridadStore.getState();
    const san = useSanitarioStore.getState();
    let removed = 0;
    action.undo.closures?.forEach((id) => {
      seg.removeClosure(id);
      removed++;
    });
    action.undo.perimeters?.forEach((id) => {
      seg.removePerimeter(id);
      removed++;
    });
    action.undo.accessControls?.forEach((id) => {
      seg.removeAccessControl(id);
      removed++;
    });
    action.undo.victims?.forEach((id) => {
      san.removeVictim(id);
      removed++;
    });
    action.undo.sanitaryZones?.forEach((id) => {
      san.removeZone(id);
      removed++;
    });
    if (action.undo.incidents?.length) {
      const incStore = useIncidentsStore.getState();
      action.undo.incidents.forEach((id) => {
        incStore.removeIncident(id);
        removed++;
      });
    }
    if (!removed) {
      return { ok: false, message: "Nada que deshacer (ya no existe en el mapa)." };
    }
    return { ok: true, message: `Deshecho: ${action.summary}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
};
