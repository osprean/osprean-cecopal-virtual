import { create } from "zustand";
import type {
  AccessControl,
  AccessControlState,
  DrawingMode,
  GeoPoint,
  ID,
  Perimeter,
  PerimeterKind,
  PerimeterShape,
  RoadBlock,
  SecurityActivity,
  SecurityActivityType,
} from "../types";
import { reverseGeocode } from "../services";
import { cecoviApi } from "../services/cecoviApi";
import { useAuthStore } from "../auth/authStore";
import { accesoFromApi, corteFromApi, perimetroFromApi, perimetroToApi } from "./cecoviMappers";
import { useIncidentsStore } from "./incidentsStore";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const nowIso = () => new Date().toISOString();

const midpoint = (a: GeoPoint, b: GeoPoint): GeoPoint => ({
  lat: (a.lat + b.lat) / 2,
  lng: (a.lng + b.lng) / 2,
});

const slug = () => useAuthStore.getState().slug ?? "";

interface ClosureGeocode {
  road: string | null;
  locality: string | null;
  loading: boolean;
  error: string | null;
}

interface SeguridadState {
  perimeters: Perimeter[];
  accessControls: AccessControl[];
  closures: RoadBlock[];
  activities: SecurityActivity[];

  mode: DrawingMode;
  drawingPoints: GeoPoint[];
  pendingPoint: GeoPoint | null;
  selectedId: ID | null;

  closureGeocode: ClosureGeocode;

  perimeterShape: PerimeterShape;
  circleCenter: GeoPoint | null;
  circleRadius: number;
  circlePreviewRadius: number;

  cargar: () => Promise<void>;

  setMode: (mode: DrawingMode) => void;
  cancelDrawing: () => void;
  addDrawingPoint: (point: GeoPoint) => void;
  setPendingPoint: (point: GeoPoint | null) => void;
  selectEntity: (id: ID | null) => void;

  setPerimeterShape: (shape: PerimeterShape) => void;
  setCircleCenter: (center: GeoPoint | null) => void;
  setCircleRadius: (radius: number) => void;
  setCirclePreviewRadius: (radius: number) => void;

  createPerimeter: (input: {
    kind: PerimeterKind;
    label: string;
    level: 1 | 2 | 3;
    color?: string;
  }) => Promise<void>;
  liftPerimeter: (id: ID) => Promise<void>;
  removePerimeter: (id: ID) => Promise<void>;

  createAccessControl: (input: {
    kind: AccessControl["kind"];
    label: string;
    state: AccessControlState;
    units?: number;
    reason?: string;
  }) => Promise<void>;
  setAccessState: (id: ID, state: AccessControlState) => Promise<void>;
  removeAccessControl: (id: ID) => Promise<void>;

  createClosure: (input: { road: string; km?: string; reason: string }) => Promise<void>;
  liftClosure: (id: ID) => Promise<void>;
  removeClosure: (id: ID) => Promise<void>;

  registerEvacuation: (input: { count: number; from: string; toShelter: string }) => void;
  registerIncident: (input: { title: string; notes: string }) => Promise<void>;

  pushActivity: (
    type: SecurityActivityType,
    message: string,
    refId?: ID,
    performedBy?: string,
  ) => void;
}

const EMPTY_GEOCODE: ClosureGeocode = { road: null, locality: null, loading: false, error: null };

let geocodeAbort: AbortController | null = null;

export const useSeguridadStore = create<SeguridadState>((set, get) => ({
  perimeters: [],
  accessControls: [],
  closures: [],
  activities: [],

  mode: "idle",
  drawingPoints: [],
  pendingPoint: null,
  selectedId: null,
  closureGeocode: EMPTY_GEOCODE,

  perimeterShape: "polygon",
  circleCenter: null,
  circleRadius: 0,
  circlePreviewRadius: 0,

  // Carga el estado real desde el backend (fuente de verdad).
  cargar: async () => {
    const s = slug();
    if (!s) return;
    const [perimetros, accesos, cortes] = await Promise.all([
      cecoviApi.seg.listPerimetros(s),
      cecoviApi.seg.listAccesos(s),
      cecoviApi.seg.listCortes(s),
    ]);
    set({
      perimeters: perimetros.map(perimetroFromApi),
      accessControls: accesos.map(accesoFromApi),
      closures: cortes.map(corteFromApi),
    });
    await useIncidentsStore.getState().cargar();
  },

  setMode: (mode) =>
    set((s) => ({
      mode,
      drawingPoints: mode === "perimeter" || mode === "closure" ? [] : s.drawingPoints,
      pendingPoint: null,
      closureGeocode: EMPTY_GEOCODE,
      circleCenter: mode === "perimeter" ? null : s.circleCenter,
      circleRadius: mode === "perimeter" ? 0 : s.circleRadius,
      circlePreviewRadius: mode === "perimeter" ? 0 : s.circlePreviewRadius,
    })),

  cancelDrawing: () => {
    geocodeAbort?.abort();
    geocodeAbort = null;
    set({
      mode: "idle",
      drawingPoints: [],
      pendingPoint: null,
      closureGeocode: EMPTY_GEOCODE,
      circleCenter: null,
      circleRadius: 0,
      circlePreviewRadius: 0,
    });
  },

  setPerimeterShape: (shape) =>
    set({
      perimeterShape: shape,
      drawingPoints: [],
      circleCenter: null,
      circleRadius: 0,
      circlePreviewRadius: 0,
    }),
  setCircleCenter: (center) => set({ circleCenter: center }),
  setCircleRadius: (radius) => set({ circleRadius: radius }),
  setCirclePreviewRadius: (radius) => set({ circlePreviewRadius: radius }),

  addDrawingPoint: (point) => {
    const { mode, drawingPoints } = get();
    if (mode === "closure") {
      if (drawingPoints.length >= 2) return;
      const next = [...drawingPoints, point];
      set({ drawingPoints: next });
      if (next.length === 1) {
        geocodeAbort?.abort();
        geocodeAbort = new AbortController();
        set({ closureGeocode: { ...EMPTY_GEOCODE, loading: true } });
        reverseGeocode(point, geocodeAbort.signal)
          .then((res) =>
            set({
              closureGeocode: {
                road: res.road,
                locality: res.locality,
                loading: false,
                error: null,
              },
            }),
          )
          .catch((err) => {
            if ((err as Error).name === "AbortError") return;
            set({
              closureGeocode: {
                road: null,
                locality: null,
                loading: false,
                error: (err as Error).message,
              },
            });
          });
      }
      return;
    }
    const shape = get().perimeterShape;
    if (mode === "perimeter" && shape === "polygon") {
      set({ drawingPoints: [...drawingPoints, point] });
    }
  },

  setPendingPoint: (point) => set({ pendingPoint: point }),
  selectEntity: (id) => set({ selectedId: id }),

  createPerimeter: async ({ kind, label, level, color }) => {
    const { perimeterShape, drawingPoints, circleCenter, circleRadius } = get();
    if (perimeterShape === "circle") {
      if (!circleCenter || circleRadius <= 0) return;
    } else if (drawingPoints.length < 3) {
      return;
    }
    const payload = perimetroToApi({
      kind,
      label,
      shape: perimeterShape,
      points: drawingPoints,
      center: circleCenter,
      radius: circleRadius,
      level,
      color,
    });
    const created = perimetroFromApi(await cecoviApi.seg.crearPerimetro(slug(), payload));
    set((s) => ({
      perimeters: [created, ...s.perimeters],
      mode: "idle",
      drawingPoints: [],
      circleCenter: null,
      circleRadius: 0,
      circlePreviewRadius: 0,
    }));
    const sizeNote = perimeterShape === "circle" ? ` (radio ${Math.round(circleRadius)} m)` : "";
    get().pushActivity(
      "perimeter-created",
      `Perímetro ${kind.toUpperCase()} "${label}" creado (Nivel ${level})${sizeNote}.`,
      created.id,
    );
  },

  liftPerimeter: async (id) => {
    await cecoviApi.seg.estadoPerimetro(slug(), Number(id), "lifted");
    const p = get().perimeters.find((x) => x.id === id);
    if (p) get().pushActivity("perimeter-lifted", `Perímetro "${p.label}" levantado.`, id);
    set((s) => ({
      perimeters: s.perimeters.map((x) => (x.id === id ? { ...x, status: "lifted" } : x)),
    }));
  },

  removePerimeter: async (id) => {
    // Sin borrado físico (I7/I8): equivale a levantar.
    await get().liftPerimeter(id);
  },

  createAccessControl: async ({ kind, label, state, units, reason }) => {
    const point = get().pendingPoint;
    if (!point) return;
    const created = accesoFromApi(
      await cecoviApi.seg.crearAcceso(slug(), {
        kind,
        label,
        lat: point.lat,
        lng: point.lng,
        units,
        reason,
      }),
    );
    if (state !== created.state) {
      await cecoviApi.seg.estadoAcceso(slug(), Number(created.id), state);
      created.state = state;
    }
    set((s) => ({
      accessControls: [created, ...s.accessControls],
      mode: "idle",
      pendingPoint: null,
    }));
    get().pushActivity(
      kind === "checkpoint" ? "checkpoint-created" : "access-changed",
      kind === "checkpoint"
        ? `Control "${label}" desplegado (${units ?? 0} efectivos).`
        : `Acceso "${label}" registrado.`,
      created.id,
    );
  },

  setAccessState: async (id, state) => {
    await cecoviApi.seg.estadoAcceso(slug(), Number(id), state);
    const ac = get().accessControls.find((x) => x.id === id);
    if (ac) get().pushActivity("access-changed", `${ac.label} cambiado a ${state.toUpperCase()}.`, id);
    set((s) => ({
      accessControls: s.accessControls.map((x) =>
        x.id === id ? { ...x, state, updatedAt: nowIso() } : x,
      ),
    }));
  },

  removeAccessControl: async (id) => {
    await cecoviApi.seg.estadoAcceso(slug(), Number(id), "closed");
    set((s) => ({
      accessControls: s.accessControls.map((x) => (x.id === id ? { ...x, state: "closed" } : x)),
    }));
  },

  createClosure: async ({ road, km, reason }) => {
    const points = get().drawingPoints;
    if (points.length < 2) return;
    const [a, b] = points;
    const mid = midpoint(a, b);
    const created = corteFromApi(
      await cecoviApi.seg.crearCorte(slug(), {
        road,
        km,
        lat: mid.lat,
        lng: mid.lng,
        segment: { from: a, to: b },
        reason,
      }),
    );
    set((s) => ({
      closures: [created, ...s.closures],
      mode: "idle",
      drawingPoints: [],
      closureGeocode: EMPTY_GEOCODE,
    }));
    get().pushActivity("street-closed", `${road}${km ? ` km ${km}` : ""} cortada — ${reason}.`, created.id);
  },

  liftClosure: async (id) => {
    await cecoviApi.seg.estadoCorte(slug(), Number(id), "lifted");
    const c = get().closures.find((x) => x.id === id);
    if (c) get().pushActivity("street-opened", `${c.road}${c.km ? ` km ${c.km}` : ""} reabierta al tráfico.`, id);
    set((s) => ({ closures: s.closures.map((x) => (x.id === id ? { ...x, status: "lifted" } : x)) }));
  },

  removeClosure: async (id) => {
    await get().liftClosure(id);
  },

  registerEvacuation: ({ count, from, toShelter }) => {
    // La evacuación como entidad vive en dirección; seguridad solo deja traza.
    const id = newId("ev");
    set({ mode: "idle", pendingPoint: null });
    get().pushActivity(
      "evacuation-registered",
      `${count} personas evacuadas de "${from}" a "${toShelter}".`,
      id,
    );
  },

  registerIncident: async ({ title, notes }) => {
    const point = get().pendingPoint;
    if (!point) return;
    await useIncidentsStore.getState().crearIncidencia({
      title,
      tipo: "security",
      severity: "medium",
      lat: point.lat,
      lng: point.lng,
      description: notes,
    });
    set({ mode: "idle", pendingPoint: null });
    get().pushActivity("incident-reported", `${title}${notes ? ` — ${notes}` : ""}`);
  },

  pushActivity: (type, message, refId, performedBy = "Sgto. Núñez · SEG") =>
    set((s) => ({
      activities: [
        { id: newId("sec-act"), type, message, performedBy, timestamp: nowIso(), refId },
        ...s.activities,
      ].slice(0, 80),
    })),
}));

export const selectActivePerimeters = (s: SeguridadState) =>
  s.perimeters.filter((p) => p.status === "active");
export const selectActiveClosures = (s: SeguridadState) =>
  s.closures.filter((c) => c.status === "active" || c.status === "intermittent");
export const selectClosedAccess = (s: SeguridadState) =>
  s.accessControls.filter((a) => a.state === "closed").length;
