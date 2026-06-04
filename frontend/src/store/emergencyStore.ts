import { create } from "zustand";
import type { Emergency, ID } from "../types";
import { mockEmergencies } from "../mocks";

interface EmergencyState {
  emergencies: Emergency[];
  activeEmergencyId: ID | null;
  setActiveEmergency: (id: ID | null) => void;
  upsertEmergency: (emergency: Emergency) => void;
  removeEmergency: (id: ID) => void;
  reset: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set) => ({
  emergencies: mockEmergencies,
  activeEmergencyId: mockEmergencies[0]?.id ?? null,
  setActiveEmergency: (id) => set({ activeEmergencyId: id }),
  upsertEmergency: (emergency) =>
    set((state) => {
      const exists = state.emergencies.some((e) => e.id === emergency.id);
      return {
        emergencies: exists
          ? state.emergencies.map((e) => (e.id === emergency.id ? emergency : e))
          : [emergency, ...state.emergencies],
      };
    }),
  removeEmergency: (id) =>
    set((state) => ({
      emergencies: state.emergencies.filter((e) => e.id !== id),
      activeEmergencyId: state.activeEmergencyId === id ? null : state.activeEmergencyId,
    })),
  reset: () =>
    set({
      emergencies: mockEmergencies,
      activeEmergencyId: mockEmergencies[0]?.id ?? null,
    }),
}));

export const selectActiveEmergency = (state: EmergencyState): Emergency | null =>
  state.emergencies.find((e) => e.id === state.activeEmergencyId) ?? null;
