import { create } from "zustand";
import type { GeoPoint, ID, Resource } from "../types";
import { mockResources } from "../mocks";

interface ResourcesState {
  resources: Resource[];
  upsertResource: (resource: Resource) => void;
  setResourceStatus: (id: ID, status: Resource["status"]) => void;
  moveResource: (id: ID, location: GeoPoint) => void;
}

export const useResourcesStore = create<ResourcesState>((set) => ({
  resources: mockResources,
  upsertResource: (resource) =>
    set((state) => {
      const exists = state.resources.some((r) => r.id === resource.id);
      return {
        resources: exists
          ? state.resources.map((r) => (r.id === resource.id ? resource : r))
          : [resource, ...state.resources],
      };
    }),
  setResourceStatus: (id, status) =>
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === id ? { ...r, status, lastUpdate: new Date().toISOString() } : r,
      ),
    })),
  moveResource: (id, location) =>
    set((state) => ({
      resources: state.resources.map((r) =>
        r.id === id ? { ...r, location, lastUpdate: new Date().toISOString() } : r,
      ),
    })),
}));
