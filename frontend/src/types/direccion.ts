import type { GeoPoint, ID, ISODateString, Severity } from "./common";
import type { ResourceKind } from "./emergency";
import type { OperationalState } from "./operational";

// Operational level of the activated plan (Spanish civil protection convention).
export type OperationalLevel = 0 | 1 | 2 | 3;

export const OPERATIONAL_LEVEL_LABEL: Record<OperationalLevel, string> = {
  0: "PRE-EMERGENCIA",
  1: "NIVEL 1 — LOCAL",
  2: "NIVEL 2 — PROVINCIAL",
  3: "NIVEL 3 — ESTATAL",
};

// Functional groups under the Director del Plan.
export type OperationalGroup =
  | "command"        // CECOPAL / Mando
  | "intervention"   // Intervención (Bomberos)
  | "medical"        // Sanitario
  | "security"       // Seguridad / FCSE
  | "logistics"      // Logístico
  | "technical"      // Apoyo Técnico
  | "psychosocial";  // Psicosocial

export const GROUP_LABEL: Record<OperationalGroup, string> = {
  command: "MANDO · CECOPAL",
  intervention: "INTERVENCIÓN",
  medical: "SANITARIO",
  security: "SEGURIDAD",
  logistics: "LOGÍSTICO",
  technical: "APOYO TÉCNICO",
  psychosocial: "PSICOSOCIAL",
};

export const GROUP_SHORT: Record<OperationalGroup, string> = {
  command: "MND",
  intervention: "INT",
  medical: "SAN",
  security: "SEG",
  logistics: "LOG",
  technical: "TEC",
  psychosocial: "PSI",
};

export interface GroupStatus {
  id: ID;
  type: OperationalGroup;
  state: OperationalState;
  membersTotal: number;
  membersActive: number;
  leader: string;
  channel?: string;          // e.g. "TETRA-104"
  lastReport: ISODateString;
}

// Solicitud de medios (PMA → Director / CECOPAL)
export type MediaRequestStatus = "pending" | "approved" | "denied" | "delivered";

export interface MediaRequest {
  id: ID;
  emergencyId: ID;
  requestedBy: string;       // PMA-Norte-01
  resourceType: ResourceKind | "personnel" | "supplies" | "transport";
  quantity: number;
  reason: string;
  priority: Severity;
  status: MediaRequestStatus;
  requestedAt: ISODateString;
  decidedAt?: ISODateString;
  eta?: ISODateString;
}

// Comunicado público o interno
export type CommuniqueAudience = "internal" | "press" | "population" | "authorities";
export type CommuniqueStatus = "draft" | "pending-approval" | "approved" | "sent";

export interface Communique {
  id: ID;
  emergencyId: ID;
  title: string;
  body: string;
  audience: CommuniqueAudience;
  status: CommuniqueStatus;
  createdBy: string;
  createdAt: ISODateString;
  approvedAt?: ISODateString;
  sentAt?: ISODateString;
}

// Evacuación (zona origen → albergue)
export type EvacuationStatus = "planned" | "in-progress" | "completed";

export interface Evacuation {
  id: ID;
  emergencyId: ID;
  name: string;
  status: EvacuationStatus;
  toShelterId: ID;
  estimatedPeople: number;
  evacuatedPeople: number;
  routePoints: GeoPoint[];   // polyline hacia albergue
  startedAt?: ISODateString;
}

// Albergue / centro de acogida
export interface Shelter {
  id: ID;
  name: string;
  location: GeoPoint;
  capacity: number;
  occupancy: number;
  state: OperationalState;
  contact?: string;
  facilities?: string[];
}

// Corte de vía / acceso
export type RoadBlockStatus = "active" | "intermittent" | "lifted";

export interface RoadBlock {
  id: ID;
  emergencyId: ID;
  road: string;
  km?: string;
  location: GeoPoint;          // midpoint (compatibility)
  segment?: { from: GeoPoint; to: GeoPoint };  // calle cortada de A a B
  reason: string;
  status: RoadBlockStatus;
  createdAt: ISODateString;
}

// Puesto de Mando Avanzado / CECOPAL en mapa
export type CommandPostType = "PMA" | "CECOPAL" | "PCA";

export interface CommandPost {
  id: ID;
  emergencyId: ID;
  code: string;
  type: CommandPostType;
  location: GeoPoint;
  commanderName: string;
  state: OperationalState;
  groups: OperationalGroup[];
  installedAt: ISODateString;
}

export interface DirectorAction {
  id: ID;
  emergencyId: ID;
  type:
    | "activated"
    | "level-escalated"
    | "level-deescalated"
    | "communique-approved"
    | "support-requested"
    | "closed";
  performedBy: string;
  timestamp: ISODateString;
  payload?: Record<string, unknown>;
  notes?: string;
}
