import { create } from "zustand";
import type {
  ID,
  InfrastructureService,
  LogisticsActivity,
  LogisticsActivityType,
  LogisticsRequest,
  LogisticsRequestStatus,
  Machinery,
  ServiceStatus,
  SupplyItem,
  Vehicle,
  VehicleState,
} from "../types";
import {
  mockLogisticsActivities,
  mockLogisticsRequests,
  mockMachinery,
  mockServices,
  mockSupplies,
  mockVehicles,
} from "../mocks";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

const computeSupplyState = (item: SupplyItem): SupplyItem["state"] => {
  if (item.stock <= 0) return "out";
  if (item.stock < item.minStock * 0.5) return "critical";
  if (item.stock < item.minStock) return "low";
  return "ok";
};

interface LogisticaState {
  supplies: SupplyItem[];
  vehicles: Vehicle[];
  machinery: Machinery[];
  services: InfrastructureService[];
  requests: LogisticsRequest[];
  activities: LogisticsActivity[];

  upsertSupply: (input: Omit<SupplyItem, "id" | "state" | "updatedAt"> & { id?: ID }) => void;
  adjustStock: (id: ID, delta: number) => void;
  setVehicleState: (id: ID, state: VehicleState) => void;
  setServiceStatus: (id: ID, status: ServiceStatus) => void;

  createRequest: (input: Omit<LogisticsRequest, "id" | "status" | "requestedAt">) => void;
  decideRequest: (id: ID, status: LogisticsRequestStatus, vehicleId?: ID | null) => void;

  pushActivity: (
    type: LogisticsActivityType,
    message: string,
    refId?: ID,
    performedBy?: string,
  ) => void;
}

export const useLogisticaStore = create<LogisticaState>((set, get) => ({
  supplies: mockSupplies,
  vehicles: mockVehicles,
  machinery: mockMachinery,
  services: mockServices,
  requests: mockLogisticsRequests,
  activities: mockLogisticsActivities,

  upsertSupply: (input) => {
    const id = input.id ?? newId("sp");
    const next: SupplyItem = {
      id,
      category: input.category,
      name: input.name,
      unit: input.unit,
      stock: input.stock,
      minStock: input.minStock,
      location: input.location,
      state: "ok",
      updatedAt: nowIso(),
    };
    next.state = computeSupplyState(next);
    set((s) => {
      const exists = s.supplies.some((x) => x.id === id);
      return {
        supplies: exists
          ? s.supplies.map((x) => (x.id === id ? next : x))
          : [next, ...s.supplies],
      };
    });
    get().pushActivity("stock-updated", `Recurso ${next.name} actualizado (${next.stock} ${next.unit}).`, id);
  },

  adjustStock: (id, delta) =>
    set((s) => {
      const updated = s.supplies.map((x) => {
        if (x.id !== id) return x;
        const next: SupplyItem = {
          ...x,
          stock: Math.max(0, x.stock + delta),
          updatedAt: nowIso(),
        };
        next.state = computeSupplyState(next);
        return next;
      });
      const item = updated.find((x) => x.id === id);
      if (item) {
        get().pushActivity(
          "stock-updated",
          `${item.name}: ${delta > 0 ? "+" : ""}${delta} ${item.unit} (${item.stock} ${item.unit}).`,
          id,
        );
      }
      return { supplies: updated };
    }),

  setVehicleState: (id, state) =>
    set((s) => {
      const v = s.vehicles.find((x) => x.id === id);
      if (v) {
        get().pushActivity("vehicle-assigned", `${v.callSign} → ${state.toUpperCase()}.`, id);
      }
      return {
        vehicles: s.vehicles.map((x) =>
          x.id === id ? { ...x, state, updatedAt: nowIso() } : x,
        ),
      };
    }),

  setServiceStatus: (id, status) =>
    set((s) => {
      const svc = s.services.find((x) => x.id === id);
      if (svc) {
        get().pushActivity(
          "service-status-changed",
          `${svc.kind.toUpperCase()} en ${svc.area}: ${status.toUpperCase()}.`,
          id,
        );
      }
      return {
        services: s.services.map((x) =>
          x.id === id ? { ...x, status, updatedAt: nowIso() } : x,
        ),
      };
    }),

  createRequest: (input) => {
    const id = newId("lreq");
    const req: LogisticsRequest = {
      ...input,
      id,
      status: "pending",
      requestedAt: nowIso(),
    };
    set((s) => ({ requests: [req, ...s.requests] }));
    get().pushActivity(
      "request-created",
      `Nueva solicitud: ${req.quantity} ${req.unit} de ${req.itemName} → ${req.destination}.`,
      id,
    );
  },

  decideRequest: (id, status, vehicleId) =>
    set((s) => {
      const req = s.requests.find((r) => r.id === id);
      if (req) {
        const typeMap: Record<LogisticsRequestStatus, LogisticsActivityType> = {
          pending: "request-created",
          approved: "request-approved",
          "in-transit": "vehicle-assigned",
          delivered: "request-delivered",
          denied: "request-denied",
        };
        get().pushActivity(typeMap[status], `${req.itemName}: ${status.toUpperCase()}.`, id);
      }
      return {
        requests: s.requests.map((r) =>
          r.id === id
            ? {
                ...r,
                status,
                decidedAt: nowIso(),
                assignedVehicleId: vehicleId ?? r.assignedVehicleId,
              }
            : r,
        ),
      };
    }),

  pushActivity: (type, message, refId, performedBy = "Coord. Romero · LOG") =>
    set((s) => ({
      activities: [
        {
          id: newId("lact"),
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

export const selectCriticalSupplies = (s: LogisticaState) =>
  s.supplies.filter((x) => x.state === "critical" || x.state === "out");

export const selectPendingLogisticsCount = (s: LogisticaState) =>
  s.requests.filter((r) => r.status === "pending").length;

export const selectServicesAffected = (s: LogisticaState) =>
  s.services.filter((x) => x.status !== "operational");
