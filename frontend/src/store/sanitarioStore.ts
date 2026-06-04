import { create } from "zustand";
import type {
  Ambulance,
  AmbulanceState,
  GeoPoint,
  Hospital,
  ID,
  SanitaryActivity,
  SanitaryActivityType,
  SanitaryAlert,
  SanitaryDrawingMode,
  SanitaryZone,
  SanitaryZoneKind,
  TriageColor,
  Victim,
  VictimStatus,
} from "../types";
import {
  mockAmbulances,
  mockHospitals,
  mockSanitaryActivities,
  mockSanitaryAlerts,
  mockSanitaryZones,
  mockVictims,
} from "../mocks";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

interface SanitarioState {
  victims: Victim[];
  ambulances: Ambulance[];
  hospitals: Hospital[];
  zones: SanitaryZone[];
  alerts: SanitaryAlert[];
  activities: SanitaryActivity[];

  // Map drawing
  mode: SanitaryDrawingMode;
  pendingPoint: GeoPoint | null;
  selectedVictimId: ID | null;

  setMode: (m: SanitaryDrawingMode) => void;
  cancelDrawing: () => void;
  setPendingPoint: (p: GeoPoint | null) => void;
  selectVictim: (id: ID | null) => void;

  registerVictim: (input: {
    triage: TriageColor;
    age?: number;
    gender?: "M" | "F" | "X";
    injuries?: string;
    notes?: string;
  }) => void;
  addZone: (input: {
    kind: SanitaryZoneKind;
    label: string;
    capacity?: number;
  }) => void;
  updateTriage: (id: ID, triage: TriageColor) => void;
  setVictimStatus: (id: ID, status: VictimStatus) => void;
  assignAmbulance: (victimId: ID, ambulanceId: ID) => void;
  deriveToHospital: (victimId: ID, hospitalId: ID) => void;
  markEvacuated: (victimId: ID) => void;

  removeVictim: (id: ID) => void;
  removeZone: (id: ID) => void;

  setAmbulanceState: (id: ID, state: AmbulanceState) => void;
  acknowledgeAlert: (id: ID) => void;
  pushAlert: (alert: Omit<SanitaryAlert, "id" | "createdAt" | "acknowledged">) => void;
  pushActivity: (
    type: SanitaryActivityType,
    message: string,
    refId?: ID,
    performedBy?: string,
  ) => void;
}

export const useSanitarioStore = create<SanitarioState>((set, get) => ({
  victims: mockVictims,
  ambulances: mockAmbulances,
  hospitals: mockHospitals,
  zones: mockSanitaryZones,
  alerts: mockSanitaryAlerts,
  activities: mockSanitaryActivities,

  mode: "idle",
  pendingPoint: null,
  selectedVictimId: null,

  setMode: (mode) => set({ mode, pendingPoint: null }),
  cancelDrawing: () => set({ mode: "idle", pendingPoint: null }),
  setPendingPoint: (pendingPoint) => set({ pendingPoint }),
  selectVictim: (selectedVictimId) => set({ selectedVictimId }),

  registerVictim: ({ triage, age, gender, injuries, notes }) => {
    const point = get().pendingPoint;
    if (!point) return;
    const code = `VIC-${String(get().victims.length + 1).padStart(3, "0")}`;
    const id = newId("vic");
    const v: Victim = {
      id,
      emergencyId: "emg-001",
      code,
      triage,
      status: "in-triage",
      age,
      gender,
      injuries,
      notes,
      location: point,
      registeredAt: nowIso(),
      updatedAt: nowIso(),
    };
    set((s) => ({
      victims: [v, ...s.victims],
      mode: "idle",
      pendingPoint: null,
    }));
    get().pushActivity(
      "victim-registered",
      `${code} registrada — triaje ${triage.toUpperCase()}.`,
      id,
    );
  },

  updateTriage: (id, triage) =>
    set((s) => {
      const victim = s.victims.find((v) => v.id === id);
      if (victim) {
        get().pushActivity(
          "triage-updated",
          `${victim.code} reclasificada a ${triage.toUpperCase()}.`,
          id,
        );
      }
      return {
        victims: s.victims.map((v) =>
          v.id === id ? { ...v, triage, updatedAt: nowIso() } : v,
        ),
      };
    }),

  setVictimStatus: (id, status) =>
    set((s) => ({
      victims: s.victims.map((v) =>
        v.id === id ? { ...v, status, updatedAt: nowIso() } : v,
      ),
    })),

  assignAmbulance: (victimId, ambulanceId) =>
    set((s) => {
      const v = s.victims.find((x) => x.id === victimId);
      const a = s.ambulances.find((x) => x.id === ambulanceId);
      if (v && a) {
        get().pushActivity(
          "ambulance-dispatched",
          `${a.callSign} asignada a ${v.code}.`,
          ambulanceId,
        );
      }
      return {
        victims: s.victims.map((x) =>
          x.id === victimId ? { ...x, assignedAmbulanceId: ambulanceId, updatedAt: nowIso() } : x,
        ),
        ambulances: s.ambulances.map((x) =>
          x.id === ambulanceId
            ? { ...x, state: "dispatched", assignedVictimId: victimId, lastUpdate: nowIso() }
            : x,
        ),
      };
    }),

  deriveToHospital: (victimId, hospitalId) =>
    set((s) => {
      const v = s.victims.find((x) => x.id === victimId);
      const h = s.hospitals.find((x) => x.id === hospitalId);
      if (v && h) {
        get().pushActivity(
          "victim-evacuated",
          `${v.code} derivada a ${h.name}.`,
          victimId,
        );
      }
      return {
        victims: s.victims.map((x) =>
          x.id === victimId
            ? { ...x, assignedHospitalId: hospitalId, status: "evacuating", updatedAt: nowIso() }
            : x,
        ),
        ambulances: s.ambulances.map((x) =>
          x.assignedVictimId === victimId
            ? { ...x, state: "transporting", destinationHospitalId: hospitalId, lastUpdate: nowIso() }
            : x,
        ),
      };
    }),

  markEvacuated: (victimId) =>
    set((s) => {
      const v = s.victims.find((x) => x.id === victimId);
      if (v) {
        get().pushActivity(
          "victim-evacuated",
          `${v.code} entregada en hospital.`,
          victimId,
        );
      }
      return {
        victims: s.victims.map((x) =>
          x.id === victimId ? { ...x, status: "delivered", updatedAt: nowIso() } : x,
        ),
        ambulances: s.ambulances.map((x) =>
          x.assignedVictimId === victimId
            ? { ...x, state: "at-hospital", lastUpdate: nowIso() }
            : x,
        ),
      };
    }),

  addZone: ({ kind, label, capacity }) => {
    const point = get().pendingPoint;
    if (!point) return;
    const id = newId("san-zone");
    const zone: SanitaryZone = {
      id,
      emergencyId: "emg-001",
      kind,
      label,
      location: point,
      capacity: capacity ?? 0,
      current: 0,
      state: "operational",
      installedAt: nowIso(),
    };
    set((s) => ({
      zones: [zone, ...s.zones],
      mode: "idle",
      pendingPoint: null,
    }));
    get().pushActivity(
      "triage-updated",
      `${kind === "triage-point" ? "Punto de triaje" : kind === "first-aid" ? "Área de socorro" : "Zona sanitaria"} "${label}" desplegada.`,
      id,
    );
  },

  removeVictim: (id) =>
    set((s) => {
      const v = s.victims.find((x) => x.id === id);
      if (v) {
        get().pushActivity("victim-registered", `${v.code} eliminada del registro.`, id);
      }
      return {
        victims: s.victims.filter((x) => x.id !== id),
        ambulances: s.ambulances.map((x) =>
          x.assignedVictimId === id
            ? { ...x, state: "available", assignedVictimId: undefined, destinationHospitalId: undefined, lastUpdate: nowIso() }
            : x,
        ),
        selectedVictimId: s.selectedVictimId === id ? null : s.selectedVictimId,
      };
    }),

  removeZone: (id) =>
    set((s) => {
      const z = s.zones.find((x) => x.id === id);
      if (z) {
        get().pushActivity("triage-updated", `Zona "${z.label}" eliminada.`, id);
      }
      return { zones: s.zones.filter((x) => x.id !== id) };
    }),

  setAmbulanceState: (id, state) =>
    set((s) => ({
      ambulances: s.ambulances.map((x) =>
        x.id === id ? { ...x, state, lastUpdate: nowIso() } : x,
      ),
    })),

  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),

  pushAlert: (alert) =>
    set((s) => ({
      alerts: [
        {
          ...alert,
          id: newId("san-alr"),
          createdAt: nowIso(),
          acknowledged: false,
        },
        ...s.alerts,
      ],
    })),

  pushActivity: (type, message, refId, performedBy = "Coord. Sanitario · SUMMA") =>
    set((s) => ({
      activities: [
        {
          id: newId("san-act"),
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

// Persist any user-created sanitary marks (víctimas registradas) en localStorage.
if (typeof window !== "undefined") {
  void import("../utils/mapPersistence").then(({ bindMapPersistence }) => {
    bindMapPersistence("san", useSanitarioStore, {
      victims: mockVictims,
      zones: mockSanitaryZones,
    });
  });
}

export const selectAvailableAmbulances = (s: SanitarioState) =>
  s.ambulances.filter((a) => a.state === "available");

export const selectVictimByTriage = (color: TriageColor) => (s: SanitarioState) =>
  s.victims.filter((v) => v.triage === color);

export const selectActiveAmbulances = (s: SanitarioState) =>
  s.ambulances.filter((a) => a.state !== "out-of-service");

export const selectUnackSanitaryAlerts = (s: SanitarioState) =>
  s.alerts.filter((a) => !a.acknowledged).length;
