import type { GeoPoint, ID, ISODateString } from "./common";

export type FieldUnitState =
  | "available"
  | "busy"
  | "en-route"
  | "support-requested"
  | "off-duty";

export const FIELD_STATE_LABEL: Record<FieldUnitState, string> = {
  available: "DISPONIBLE",
  busy: "OCUPADO",
  "en-route": "EN RUTA",
  "support-requested": "APOYO SOLICITADO",
  "off-duty": "FUERA SERVICIO",
};

export type FieldTaskStatus =
  | "incoming"     // recibida, sin aceptar
  | "accepted"     // aceptada por la unidad
  | "on-scene"     // llegada a destino
  | "completed"
  | "cancelled";

export type FieldTaskPriority = "critical" | "high" | "medium" | "low";

export interface FieldTask {
  id: ID;
  emergencyId: ID;
  code: string;            // T-204
  title: string;
  description: string;
  priority: FieldTaskPriority;
  status: FieldTaskStatus;
  assignedTo: string;      // call-sign
  location: GeoPoint;
  destination?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  acceptedAt?: ISODateString;
  completedAt?: ISODateString;
}

export type FieldReportKind =
  | "incident"
  | "voice"
  | "image"
  | "checkpoint"
  | "support";

export interface FieldReport {
  id: ID;
  emergencyId: ID;
  kind: FieldReportKind;
  title: string;
  body: string;
  location?: GeoPoint;
  imageUrl?: string;
  transcribed?: boolean;       // marca true cuando viene de voz
  createdAt: ISODateString;
  createdBy: string;
}

export interface FieldUnit {
  id: ID;
  callSign: string;            // BINOMIO-3
  operator: string;            // "Cabo Vega + Patrullero Soto"
  state: FieldUnitState;
  location: GeoPoint;
  battery: number;             // % radio/dispositivo
  lastPing: ISODateString;
  activeTaskId?: ID | null;
}

export interface NavigationTarget {
  id: ID;
  label: string;
  kind: "incident" | "shelter" | "rendezvous" | "checkpoint";
  location: GeoPoint;
  distanceKm?: number;         // computed when active
  bearing?: number;            // 0..360
}
