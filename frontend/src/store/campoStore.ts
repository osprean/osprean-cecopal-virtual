import { create } from "zustand";
import type {
  FieldReport,
  FieldReportKind,
  FieldTask,
  FieldTaskStatus,
  FieldUnit,
  FieldUnitState,
  GeoPoint,
  ID,
  NavigationTarget,
} from "../types";
import {
  mockFieldReports,
  mockFieldTasks,
  mockFieldUnit,
  mockNearbyTargets,
} from "../mocks";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

interface CampoState {
  unit: FieldUnit;
  tasks: FieldTask[];
  reports: FieldReport[];
  targets: NavigationTarget[];
  selectedTargetId: ID | null;

  setUnitState: (state: FieldUnitState) => void;
  acceptTask: (id: ID) => void;
  markOnScene: (id: ID) => void;
  completeTask: (id: ID) => void;
  cancelTask: (id: ID) => void;

  addReport: (input: {
    kind: FieldReportKind;
    title: string;
    body: string;
    location?: GeoPoint;
    imageUrl?: string;
    transcribed?: boolean;
  }) => void;

  selectTarget: (id: ID | null) => void;
  requestSupport: (notes?: string) => void;
  shareLocation: () => void;
}

export const useCampoStore = create<CampoState>((set, get) => ({
  unit: mockFieldUnit,
  tasks: mockFieldTasks,
  reports: mockFieldReports,
  targets: mockNearbyTargets,
  selectedTargetId: mockNearbyTargets[0]?.id ?? null,

  setUnitState: (state) =>
    set((s) => ({
      unit: { ...s.unit, state, lastPing: nowIso() },
    })),

  acceptTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "accepted" as FieldTaskStatus, acceptedAt: nowIso(), updatedAt: nowIso() }
          : t,
      ),
      unit: { ...s.unit, state: "en-route", activeTaskId: id },
    })),

  markOnScene: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "on-scene", updatedAt: nowIso() } : t,
      ),
      unit: { ...s.unit, state: "busy" },
    })),

  completeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status: "completed", completedAt: nowIso(), updatedAt: nowIso() }
          : t,
      ),
      unit: {
        ...s.unit,
        state: "available",
        activeTaskId: s.unit.activeTaskId === id ? null : s.unit.activeTaskId,
      },
    })),

  cancelTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, status: "cancelled", updatedAt: nowIso() } : t,
      ),
      unit: {
        ...s.unit,
        state: "available",
        activeTaskId: s.unit.activeTaskId === id ? null : s.unit.activeTaskId,
      },
    })),

  addReport: ({ kind, title, body, location, imageUrl, transcribed }) => {
    const report: FieldReport = {
      id: newId("frp"),
      emergencyId: "emg-001",
      kind,
      title,
      body,
      location: location ?? get().unit.location,
      imageUrl,
      transcribed,
      createdAt: nowIso(),
      createdBy: get().unit.callSign,
    };
    set((s) => ({ reports: [report, ...s.reports].slice(0, 100) }));
  },

  selectTarget: (id) => set({ selectedTargetId: id }),

  requestSupport: (notes) => {
    const body = notes ?? "Solicitud de apoyo táctico — sin detalles.";
    set((s) => ({
      unit: { ...s.unit, state: "support-requested", lastPing: nowIso() },
    }));
    get().addReport({
      kind: "support",
      title: "APOYO SOLICITADO",
      body,
    });
  },

  shareLocation: () => {
    const u = get().unit;
    get().addReport({
      kind: "checkpoint",
      title: "Ubicación compartida",
      body: `Lat ${u.location.lat.toFixed(5)}, Lng ${u.location.lng.toFixed(5)} · ${u.callSign}`,
      location: u.location,
    });
  },
}));

export const selectActiveTask = (s: CampoState) =>
  s.tasks.find((t) => t.id === s.unit.activeTaskId) ?? null;

export const selectIncomingTasks = (s: CampoState) =>
  s.tasks.filter((t) => t.status === "incoming");
