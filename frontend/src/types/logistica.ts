import type { ID, ISODateString } from "./common";

export type SupplyCategory =
  | "water"
  | "food"
  | "medical"
  | "fuel"
  | "ppe"
  | "tools"
  | "other";

export const SUPPLY_LABEL: Record<SupplyCategory, string> = {
  water: "AGUA",
  food: "ALIMENTACIÓN",
  medical: "SANITARIO",
  fuel: "COMBUSTIBLE",
  ppe: "EPI",
  tools: "HERRAMIENTAS",
  other: "OTROS",
};

export type SupplyState = "ok" | "low" | "critical" | "out";

export interface SupplyItem {
  id: ID;
  category: SupplyCategory;
  name: string;
  unit: string;              // "L", "kg", "ud"
  stock: number;
  minStock: number;
  location: string;          // "Pabellón Robledo · Almacén 1"
  state: SupplyState;
  updatedAt: ISODateString;
}

export type VehicleKind =
  | "command-vehicle"
  | "transport-truck"
  | "supply-van"
  | "fuel-tank"
  | "off-road"
  | "bus";

export type VehicleState = "available" | "deployed" | "maintenance" | "out-of-service";

export interface Vehicle {
  id: ID;
  callSign: string;
  kind: VehicleKind;
  state: VehicleState;
  capacity: string;          // "8 plazas", "8000 L", "5 t"
  fuelPct: number;           // 0..100
  driver?: string;
  location: string;          // "Base Logística Robledo"
  updatedAt: ISODateString;
}

export type MachineryKind =
  | "generator"
  | "pump"
  | "lighting"
  | "compressor"
  | "crane"
  | "bulldozer";

export interface Machinery {
  id: ID;
  callSign: string;
  kind: MachineryKind;
  state: "operational" | "deployed" | "maintenance" | "down";
  location: string;
  notes?: string;
  updatedAt: ISODateString;
}

export type ServiceKind = "water" | "electricity" | "gas" | "telecom" | "sewer";

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  water: "AGUA",
  electricity: "ELECTRICIDAD",
  gas: "GAS",
  telecom: "TELEFONÍA",
  sewer: "SANEAMIENTO",
};

export type ServiceStatus = "operational" | "degraded" | "outage" | "restoring";

export interface InfrastructureService {
  id: ID;
  kind: ServiceKind;
  area: string;              // zona afectada
  status: ServiceStatus;
  affectedPopulation: number;
  provider: string;
  notes?: string;
  estimatedRestore?: ISODateString;
  updatedAt: ISODateString;
}

export type LogisticsRequestStatus =
  | "pending"
  | "approved"
  | "in-transit"
  | "delivered"
  | "denied";

export type LogisticsRequestPriority = "critical" | "high" | "medium" | "low";

export interface LogisticsRequest {
  id: ID;
  emergencyId: ID;
  requestedBy: string;
  category: SupplyCategory | "vehicle" | "machinery" | "personnel";
  itemName: string;
  quantity: number;
  unit: string;
  priority: LogisticsRequestPriority;
  status: LogisticsRequestStatus;
  destination: string;
  requestedAt: ISODateString;
  decidedAt?: ISODateString;
  eta?: ISODateString;
  assignedVehicleId?: ID | null;
  notes?: string;
}

export type LogisticsActivityType =
  | "stock-updated"
  | "request-created"
  | "request-approved"
  | "request-denied"
  | "request-delivered"
  | "vehicle-assigned"
  | "service-status-changed"
  | "shelter-updated";

export interface LogisticsActivity {
  id: ID;
  type: LogisticsActivityType;
  message: string;
  performedBy: string;
  timestamp: ISODateString;
  refId?: ID;
}
