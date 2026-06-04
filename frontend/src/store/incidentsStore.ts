import { create } from "zustand";
import type { ID, Incident, Status } from "../types";
import { mockIncidents } from "../mocks";

interface IncidentsState {
  incidents: Incident[];
  selectedIncidentId: ID | null;
  selectIncident: (id: ID | null) => void;
  upsertIncident: (incident: Incident) => void;
  setIncidentStatus: (id: ID, status: Status) => void;
  removeIncident: (id: ID) => void;
  assignResource: (incidentId: ID, resourceId: ID) => void;
  unassignResource: (incidentId: ID, resourceId: ID) => void;
}

export const useIncidentsStore = create<IncidentsState>((set) => ({
  incidents: mockIncidents,
  selectedIncidentId: null,
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
  setIncidentStatus: (id, status) =>
    set((state) => ({
      incidents: state.incidents.map((i) => (i.id === id ? { ...i, status } : i)),
    })),
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
