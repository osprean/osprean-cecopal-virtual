import type {
  EmergencyDomain,
  GeoPoint,
  ID,
  ISODateString,
  Severity,
  Status,
} from "./common";

export interface Emergency {
  id: ID;
  code: string;
  name: string;
  domain: EmergencyDomain;
  severity: Severity;
  status: Status;
  startedAt: ISODateString;
  updatedAt: ISODateString;
  location: GeoPoint;
  area: GeoPoint[] | null;
  affectedPopulation: number;
  description: string;
  commandPost?: string;
  responsibleAgency?: string;
}

export interface Alert {
  id: ID;
  emergencyId: ID | null;
  source: string;
  severity: Severity;
  message: string;
  createdAt: ISODateString;
  acknowledged: boolean;
  location?: GeoPoint;
}

export interface Incident {
  id: ID;
  emergencyId: ID;
  title: string;
  type: EmergencyDomain;
  severity: Severity;
  status: Status;
  reportedAt: ISODateString;
  location: GeoPoint;
  description: string;
  assignedResources: ID[];
}

export type ResourceKind =
  | "fire-truck"
  | "ambulance"
  | "police-unit"
  | "drone"
  | "helicopter"
  | "team"
  | "command-vehicle";

export interface RoadBlockSegment {
  from: GeoPoint;
  to: GeoPoint;
}

export interface Resource {
  id: ID;
  callSign: string;
  kind: ResourceKind;
  status: "available" | "deployed" | "returning" | "offline" | "maintenance";
  agency: string;
  capacity?: number;
  location: GeoPoint;
  assignedIncidentId?: ID | null;
  lastUpdate: ISODateString;
}

export interface RealtimeEvent {
  id: ID;
  type: "alert" | "resource-move" | "status-change" | "comm" | "system";
  level: Severity;
  message: string;
  timestamp: ISODateString;
  refId?: ID;
}
