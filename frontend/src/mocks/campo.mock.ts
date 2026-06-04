import type { FieldReport, FieldTask, FieldUnit, NavigationTarget } from "../types";

export const mockFieldUnit: FieldUnit = {
  id: "fu-binomio-3",
  callSign: "BINOMIO-3",
  operator: "—",
  state: "available",
  location: { lat: 40.2295, lng: -4.0156 },
  battery: 100,
  lastPing: "2026-05-18T09:00:00Z",
  activeTaskId: null,
};

export const mockFieldTasks: FieldTask[] = [];

export const mockFieldReports: FieldReport[] = [];

export const mockNearbyTargets: NavigationTarget[] = [];
