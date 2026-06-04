import type { GeoPoint, ID, ISODateString } from "./common";

export type AccessControlKind = "access" | "checkpoint";
export type AccessControlState = "open" | "restricted" | "closed";

export interface AccessControl {
  id: ID;
  emergencyId: ID;
  kind: AccessControlKind;
  label: string;
  location: GeoPoint;
  state: AccessControlState;
  units?: number;          // efectivos desplegados (checkpoint)
  reason?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type PerimeterKind = "exclusion" | "evacuation" | "safety" | "buffer";

export const PERIMETER_LABEL: Record<PerimeterKind, string> = {
  exclusion: "EXCLUSIÓN",
  evacuation: "EVACUACIÓN",
  safety: "SEGURIDAD",
  buffer: "AMORTIGUACIÓN",
};

// Paleta táctica para perímetros: 8 colores nombrados disponibles tanto en la
// UI manual (chips) como en la IA (parámetro 'color' del tool).
export const PERIMETER_PALETTE: { name: string; hex: string; label: string }[] = [
  { name: "red", hex: "#E53E3E", label: "Rojo" },
  { name: "orange", hex: "#DD6B20", label: "Naranja" },
  { name: "yellow", hex: "#D69E2E", label: "Amarillo" },
  { name: "green", hex: "#38A169", label: "Verde" },
  { name: "teal", hex: "#319795", label: "Verde azulado" },
  { name: "blue", hex: "#3182CE", label: "Azul" },
  { name: "purple", hex: "#805AD5", label: "Morado" },
  { name: "pink", hex: "#D53F8C", label: "Rosa" },
];

export type PerimeterShape = "polygon" | "circle";

export interface Perimeter {
  id: ID;
  emergencyId: ID;
  kind: PerimeterKind;
  label: string;
  points: GeoPoint[];      // polígono cerrado (vacío si shape === "circle")
  level: 1 | 2 | 3;
  status: "active" | "lifted";
  createdAt: ISODateString;
  shape?: PerimeterShape;  // por compatibilidad — ausente = polygon
  center?: GeoPoint;       // sólo para shape === "circle"
  radius?: number;         // metros, sólo para shape === "circle"
  color?: string;          // hex CSS opcional; si está presente sobreescribe el color del kind
}

export type SecurityActivityType =
  | "perimeter-created"
  | "perimeter-lifted"
  | "access-changed"
  | "street-closed"
  | "street-opened"
  | "checkpoint-created"
  | "evacuation-registered"
  | "incident-reported";

export interface SecurityActivity {
  id: ID;
  type: SecurityActivityType;
  message: string;
  performedBy: string;
  timestamp: ISODateString;
  refId?: ID;
}

// Drawing modes en el mapa
export type DrawingMode =
  | "idle"
  | "perimeter"
  | "checkpoint"
  | "access"
  | "closure"
  | "incident"
  | "evacuation";
