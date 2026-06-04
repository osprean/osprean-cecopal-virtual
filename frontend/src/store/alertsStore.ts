import { create } from "zustand";
import type { Alert, ID } from "../types";
import { mockAlerts } from "../mocks";

interface AlertsState {
  alerts: Alert[];
  pushAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: ID) => void;
  clearAcknowledged: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: mockAlerts,
  pushAlert: (alert) =>
    set((state) => ({ alerts: [alert, ...state.alerts] })),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    })),
  clearAcknowledged: () =>
    set((state) => ({ alerts: state.alerts.filter((a) => !a.acknowledged) })),
}));

export const selectUnacknowledgedCount = (state: AlertsState) =>
  state.alerts.filter((a) => !a.acknowledged).length;
