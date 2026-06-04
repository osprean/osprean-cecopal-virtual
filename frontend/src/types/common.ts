export type ID = string;

export type ISODateString = string;

export type LatLng = [number, number];

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Status = "active" | "monitoring" | "resolved" | "dispatched" | "standby";

export type EmergencyDomain =
  | "fire"
  | "flood"
  | "medical"
  | "seismic"
  | "chemical"
  | "security"
  | "traffic-accident"
  | "other";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}
