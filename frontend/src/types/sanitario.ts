import type { GeoPoint, ID, ISODateString } from "./common";

// Triage START (Spanish civil protection sanitarios)
export type TriageColor = "red" | "yellow" | "green" | "black" | "unset";

export const TRIAGE_LABEL: Record<TriageColor, string> = {
  red: "T1 · INMEDIATO",
  yellow: "T2 · DEMORADO",
  green: "T3 · LEVE",
  black: "T4 · FALLECIDO",
  unset: "PENDIENTE",
};

export const TRIAGE_SHORT: Record<TriageColor, string> = {
  red: "ROJO",
  yellow: "AMBR",
  green: "VERDE",
  black: "NEGRO",
  unset: "S/T",
};

export type VictimStatus =
  | "on-scene"        // en escena, sin atender
  | "in-triage"       // en proceso de triaje
  | "stabilized"      // estabilizado en área de socorro
  | "evacuating"      // en ruta a hospital
  | "delivered"       // entregado a hospital
  | "discharged";     // dado de alta

export interface Victim {
  id: ID;
  emergencyId: ID;
  code: string;             // VIC-001
  triage: TriageColor;
  status: VictimStatus;
  age?: number;
  gender?: "M" | "F" | "X";
  notes?: string;
  injuries?: string;
  location: GeoPoint;
  assignedAmbulanceId?: ID | null;
  assignedHospitalId?: ID | null;
  registeredAt: ISODateString;
  updatedAt: ISODateString;
}

export type AmbulanceKind = "SVB" | "SVA" | "VIR" | "TNA"; // SVB básica, SVA avanzada, VIR vehículo intervención rápida, TNA traslado no asistido

export type AmbulanceState =
  | "available"
  | "dispatched"
  | "on-scene"
  | "transporting"
  | "at-hospital"
  | "returning"
  | "out-of-service";

export interface Ambulance {
  id: ID;
  callSign: string;          // "AMB-04"
  kind: AmbulanceKind;
  state: AmbulanceState;
  crew: number;
  location: GeoPoint;
  assignedVictimId?: ID | null;
  destinationHospitalId?: ID | null;
  etaMinutes?: number;
  lastUpdate: ISODateString;
}

export type HospitalLevel = "primary" | "general" | "trauma" | "specialized";

export interface Hospital {
  id: ID;
  name: string;
  level: HospitalLevel;
  location: GeoPoint;
  // Saturación por triage
  beds: { total: number; available: number };
  red: { capacity: number; current: number };
  yellow: { capacity: number; current: number };
  green: { capacity: number; current: number };
  surgeryRooms: { total: number; available: number };
  contact?: string;
  state: "operational" | "saturated" | "critical" | "offline";
}

// Punto de triaje / área de socorro / nido de heridos
export type SanitaryZoneKind = "triage-point" | "first-aid" | "morgue" | "hospital-tent";

export interface SanitaryZone {
  id: ID;
  emergencyId: ID;
  kind: SanitaryZoneKind;
  label: string;
  location: GeoPoint;
  capacity: number;
  current: number;
  state: "operational" | "saturated" | "closed";
  installedAt: ISODateString;
}

export interface SanitaryAlert {
  id: ID;
  emergencyId: ID;
  source: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low";
  createdAt: ISODateString;
  acknowledged: boolean;
}

export type SanitaryActivityType =
  | "victim-registered"
  | "triage-updated"
  | "ambulance-dispatched"
  | "ambulance-state"
  | "victim-evacuated"
  | "hospital-saturation"
  | "alert-raised";

export interface SanitaryActivity {
  id: ID;
  type: SanitaryActivityType;
  message: string;
  performedBy: string;
  timestamp: ISODateString;
  refId?: ID;
}

export type SanitaryDrawingMode = "idle" | "victim" | "triage-point" | "first-aid";
