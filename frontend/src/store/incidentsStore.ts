import { create } from "zustand";
import type { ID, Incident, Status } from "../types";
import { cecoviApi } from "../services/cecoviApi";
import { useAuthStore } from "../auth/authStore";
import { incidenciaFromApi } from "./cecoviMappers";

const slug = () => useAuthStore.getState().slug ?? "";

interface IncidentsState {
  incidents: Incident[];
  selectedIncidentId: ID | null;
  cargar: () => Promise<void>;
  crearIncidencia: (input: {
    title: string;
    tipo: string;
    severity: string;
    lat?: number;
    lng?: number;
    description?: string;
  }) => Promise<void>;
  selectIncident: (id: ID | null) => void;
  upsertIncident: (incident: Incident) => void;
  setIncidentStatus: (id: ID, status: Status) => Promise<void>;
  removeIncident: (id: ID) => void;
  assignResource: (incidentId: ID, resourceId: ID) => void;
  unassignResource: (incidentId: ID, resourceId: ID) => void;
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: [],
  selectedIncidentId: null,

  cargar: async () => {
    const s = slug();
    if (!s) return;
    const rows = await cecoviApi.seg.listIncidencias(s);
    set({ incidents: rows.map(incidenciaFromApi) });
  },

  crearIncidencia: async (input) => {
    const created = incidenciaFromApi(await cecoviApi.seg.crearIncidencia(slug(), input));
    set((state) => ({ incidents: [created, ...state.incidents] }));
  },

  selectIncident: (id) => set({ selectedIncidentId: id }),

  upsertIncident: (incident) =>
    set((state) => {
      const exists = state.incidents.some((i) => i.id === incident.id);
      return {
        incidents: exists
          ? state.incidents.map((i) => (i.id === incident.id ? incident : i))
          : [incident, ...state.incidents],
      };
    }),

  setIncidentStatus: async (id, status) => {
    await cecoviApi.seg.estadoIncidencia(slug(), Number(id), status);
    set((state) => ({
      incidents: state.incidents.map((i) => (i.id === id ? { ...i, status } : i)),
    }));
  },

  removeIncident: (id) =>
    set((state) => ({
      incidents: state.incidents.filter((i) => i.id !== id),
      selectedIncidentId: state.selectedIncidentId === id ? null : state.selectedIncidentId,
    })),

  assignResource: (incidentId, resourceId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId && !i.assignedResources.includes(resourceId)
          ? { ...i, assignedResources: [...i.assignedResources, resourceId] }
          : i,
      ),
    })),

  unassignResource: (incidentId, resourceId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId
          ? { ...i, assignedResources: i.assignedResources.filter((r) => r !== resourceId) }
          : i,
      ),
    })),
}));
