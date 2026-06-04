import { create } from "zustand";
import type {
  AccessControl,
  AccessControlState,
  DrawingMode,
  GeoPoint,
  ID,
  Incident,
  Perimeter,
  PerimeterKind,
  PerimeterShape,
  RoadBlock,
  SecurityActivity,
  SecurityActivityType,
} from "../types";
import {
  mockAccessControls,
  mockPerimeters,
  mockRoadBlocks,
  mockSecurityActivities,
} from "../mocks";
import { reverseGeocode } from "../services";
import { useIncidentsStore } from "./incidentsStore";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const nowIso = () => new Date().toISOString();

const midpoint = (a: GeoPoint, b: GeoPoint): GeoPoint => ({
  lat: (a.lat + b.lat) / 2,
  lng: (a.lng + b.lng) / 2,
});

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

  // Sub-modo del perímetro: polígono (vértices) o círculo (centro + radio).
  perimeterShape: PerimeterShape;
  circleCenter: GeoPoint | null;
  circleRadius: number; // metros (0 mientras no se haya confirmado)
  circlePreviewRadius: number; // metros — actualizado con el ratón antes del 2º click

  setMode: (mode: DrawingMode) => void;
  cancelDrawing: () => void;
  addDrawingPoint: (point: GeoPoint) => void;
  setPendingPoint: (point: GeoPoint | null) => void;
  selectEntity: (id: ID | null) => void;

  setPerimeterShape: (shape: PerimeterShape) => void;
  setCircleCenter: (center: GeoPoint | null) => void;
  setCircleRadius: (radius: number) => void;
  setCirclePreviewRadius: (radius: number) => void;

  createPerimeter: (input: { kind: PerimeterKind; label: string; level: 1 | 2 | 3; color?: string }) => void;
  liftPerimeter: (id: ID) => void;
  removePerimeter: (id: ID) => void;

  createAccessControl: (input: {
    kind: AccessControl["kind"];
    label: string;
    state: AccessControlState;
    units?: number;
    reason?: string;
  }) => void;
  setAccessState: (id: ID, state: AccessControlState) => void;
  removeAccessControl: (id: ID) => void;

  createClosure: (input: { road: string; km?: string; reason: string }) => void;
  liftClosure: (id: ID) => void;
  removeClosure: (id: ID) => void;

  registerEvacuation: (input: { count: number; from: string; toShelter: string }) => void;
  registerIncident: (input: { title: string; notes: string }) => void;

  pushActivity: (
    type: SecurityActivityType,
    message: string,
    refId?: ID,
    performedBy?: string,
  ) => void;
}

const EMPTY_GEOCODE: ClosureGeocode = {
  road: null,
  locality: null,
  loading: false,
  error: null,
};

let geocodeAbort: AbortController | null = null;

export const useSeguridadStore = create<SeguridadState>((set, get) => ({
  perimeters: mockPerimeters,
  accessControls: mockAccessControls,
  closures: mockRoadBlocks,
  activities: mockSecurityActivities,

  mode: "idle",
  drawingPoints: [],
  pendingPoint: null,
  selectedId: null,
  closureGeocode: EMPTY_GEOCODE,

  perimeterShape: "polygon",
  circleCenter: null,
  circleRadius: 0,
  circlePreviewRadius: 0,

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

    // CLOSURE: 2 points (A then B). Trigger reverse geocode after first point.
    if (mode === "closure") {
      if (drawingPoints.length >= 2) return;
      const next = [...drawingPoints, point];
      set({ drawingPoints: next });

      if (next.length === 1) {
        // Geocode the start point in background — by the time B is placed
        // the road name is usually ready.
        geocodeAbort?.abort();
        geocodeAbort = new AbortController();
        set({ closureGeocode: { ...EMPTY_GEOCODE, loading: true } });
        reverseGeocode(point, geocodeAbort.signal)
          .then((res) => {
            set({
              closureGeocode: {
                road: res.road,
                locality: res.locality,
                loading: false,
                error: null,
              },
            });
          })
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

    // PERIMETER POLYGON: any number of points.
    // PERIMETER CIRCLE: handled by SeguridadMapLayers (center + radius) — no-op here.
    const shape = get().perimeterShape;
    if (mode === "perimeter" && shape === "polygon") {
      set({ drawingPoints: [...drawingPoints, point] });
    }
  },

  setPendingPoint: (point) => set({ pendingPoint: point }),

  selectEntity: (id) => set({ selectedId: id }),

  createPerimeter: ({ kind, label, level, color }) => {
    const { perimeterShape, drawingPoints, circleCenter, circleRadius } = get();
    const id = newId("per");
    let perimeter: Perimeter;

    if (perimeterShape === "circle") {
      if (!circleCenter || circleRadius <= 0) return;
      perimeter = {
        id,
        emergencyId: "emg-001",
        kind,
        label,
        points: [],
        level,
        status: "active",
        createdAt: nowIso(),
        shape: "circle",
        center: circleCenter,
        radius: circleRadius,
        color,
      };
    } else {
      if (drawingPoints.length < 3) return;
      perimeter = {
        id,
        emergencyId: "emg-001",
        kind,
        label,
        points: drawingPoints,
        level,
        status: "active",
        createdAt: nowIso(),
        shape: "polygon",
        color,
      };
    }

    set((s) => ({
      perimeters: [perimeter, ...s.perimeters],
      mode: "idle",
      drawingPoints: [],
      circleCenter: null,
      circleRadius: 0,
      circlePreviewRadius: 0,
    }));
    const sizeNote =
      perimeterShape === "circle"
        ? ` (radio ${Math.round(circleRadius)} m)`
        : "";
    get().pushActivity(
      "perimeter-created",
      `Perímetro ${kind.toUpperCase()} "${label}" creado (Nivel ${level})${sizeNote}.`,
      id,
    );
  },

  liftPerimeter: (id) =>
    set((s) => {
      const p = s.perimeters.find((x) => x.id === id);
      if (p) {
        get().pushActivity("perimeter-lifted", `Perímetro "${p.label}" levantado.`, id);
      }
      return {
        perimeters: s.perimeters.map((x) => (x.id === id ? { ...x, status: "lifted" } : x)),
      };
    }),

  removePerimeter: (id) =>
    set((s) => {
      const p = s.perimeters.find((x) => x.id === id);
      if (p) {
        get().pushActivity("perimeter-lifted", `Perímetro "${p.label}" eliminado.`, id);
      }
      return { perimeters: s.perimeters.filter((x) => x.id !== id) };
    }),

  createAccessControl: ({ kind, label, state, units, reason }) => {
    const point = get().pendingPoint;
    if (!point) return;
    const id = newId(kind === "checkpoint" ? "ck" : "ac");
    const ac: AccessControl = {
      id,
      emergencyId: "emg-001",
      kind,
      label,
      state,
      units,
      reason,
      location: point,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((s) => ({
      accessControls: [ac, ...s.accessControls],
      mode: "idle",
      pendingPoint: null,
    }));
    get().pushActivity(
      kind === "checkpoint" ? "checkpoint-created" : "access-changed",
      kind === "checkpoint"
        ? `Control "${label}" desplegado (${units ?? 0} efectivos).`
        : `Acceso "${label}" registrado.`,
      id,
    );
  },

  setAccessState: (id, state) =>
    set((s) => {
      const ac = s.accessControls.find((x) => x.id === id);
      if (ac) {
        get().pushActivity(
          "access-changed",
          `${ac.label} cambiado a ${state.toUpperCase()}.`,
          id,
        );
      }
      return {
        accessControls: s.accessControls.map((x) =>
          x.id === id ? { ...x, state, updatedAt: nowIso() } : x,
        ),
      };
    }),

  removeAccessControl: (id) =>
    set((s) => ({
      accessControls: s.accessControls.filter((x) => x.id !== id),
    })),

  createClosure: ({ road, km, reason }) => {
    const points = get().drawingPoints;
    if (points.length < 2) return;
    const [a, b] = points;
    const id = newId("rb");
    const closure: RoadBlock = {
      id,
      emergencyId: "emg-001",
      road,
      km,
      location: midpoint(a, b),
      segment: { from: a, to: b },
      reason,
      status: "active",
      createdAt: nowIso(),
    };
    set((s) => ({
      closures: [closure, ...s.closures],
      mode: "idle",
      drawingPoints: [],
      closureGeocode: EMPTY_GEOCODE,
    }));
    get().pushActivity(
      "street-closed",
      `${road}${km ? ` km ${km}` : ""} cortada — ${reason}.`,
      id,
    );
  },

  liftClosure: (id) =>
    set((s) => {
      const c = s.closures.find((x) => x.id === id);
      if (c) {
        get().pushActivity(
          "street-opened",
          `${c.road}${c.km ? ` km ${c.km}` : ""} reabierta al tráfico.`,
          id,
        );
      }
      return {
        closures: s.closures.map((x) => (x.id === id ? { ...x, status: "lifted" } : x)),
      };
    }),

  removeClosure: (id) =>
    set((s) => {
      const c = s.closures.find((x) => x.id === id);
      if (c) {
        get().pushActivity(
          "street-opened",
          `${c.road}${c.km ? ` km ${c.km}` : ""} eliminada.`,
          id,
        );
      }
      return { closures: s.closures.filter((x) => x.id !== id) };
    }),

  registerEvacuation: ({ count, from, toShelter }) => {
    const id = newId("ev");
    set({ mode: "idle", pendingPoint: null });
    get().pushActivity(
      "evacuation-registered",
      `${count} personas evacuadas de "${from}" a "${toShelter}".`,
      id,
    );
  },

  registerIncident: ({ title, notes }) => {
    const point = get().pendingPoint;
    if (!point) return;
    const id = newId("inc");
    const incident: Incident = {
      id,
      emergencyId: "emg-001",
      title,
      type: "security",
      severity: "medium",
      status: "active",
      reportedAt: nowIso(),
      location: point,
      description: notes,
      assignedResources: [],
    };
    useIncidentsStore.getState().upsertIncident(incident);
    set({ mode: "idle", pendingPoint: null });
    get().pushActivity("incident-reported", `${title}${notes ? ` — ${notes}` : ""}`, id);
  },

  pushActivity: (type, message, refId, performedBy = "Sgto. Núñez · SEG") =>
    set((s) => ({
      activities: [
        {
          id: newId("sec-act"),
          type,
          message,
          performedBy,
          timestamp: nowIso(),
          refId,
        },
        ...s.activities,
      ].slice(0, 80),
    })),
}));

// Persist any user-created perimeters / accesos / cierres en localStorage.
// Mocks iniciales se ignoran — solo se guardan las marcas nuevas.
if (typeof window !== "undefined") {
  // Lazy import to avoid SSR pitfalls and keep the store file lean.
  void import("../utils/mapPersistence").then(({ bindMapPersistence }) => {
    bindMapPersistence("seg", useSeguridadStore, {
      perimeters: mockPerimeters,
      accessControls: mockAccessControls,
      closures: mockRoadBlocks,
    });
  });
}

export const selectActivePerimeters = (s: SeguridadState) =>
  s.perimeters.filter((p) => p.status === "active");

export const selectActiveClosures = (s: SeguridadState) =>
  s.closures.filter((c) => c.status === "active" || c.status === "intermittent");

export const selectClosedAccess = (s: SeguridadState) =>
  s.accessControls.filter((a) => a.state === "closed").length;
