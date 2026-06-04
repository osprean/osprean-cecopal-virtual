// Mapeo entre las entidades del backend CECOVI (snake_case, estado) y las del
// store del front (emergency-manager). El backend es la fuente de verdad; estos
// mappers traducen en ambos sentidos para no tocar las vistas/tipos del front.

import type { AccessControl, Incident, Perimeter, RoadBlock } from "../types";

// --- perímetros ---
export function perimetroFromApi(a: any): Perimeter {
  return {
    id: String(a.id),
    emergencyId: String(a.emergencia_id),
    kind: a.kind,
    label: a.label,
    points: a.points ?? [],
    level: (a.nivel ?? 1) as 1 | 2 | 3,
    status: a.estado,
    createdAt: a.created_at,
    shape: a.shape,
    center: a.center_lat != null ? { lat: a.center_lat, lng: a.center_lng } : undefined,
    radius: a.radius_m ?? undefined,
    color: a.color ?? undefined,
  };
}

export function perimetroToApi(p: {
  kind: string;
  label: string;
  shape: "polygon" | "circle";
  points?: { lat: number; lng: number }[];
  center?: { lat: number; lng: number } | null;
  radius?: number;
  level?: number;
  color?: string;
}): Record<string, unknown> {
  return {
    kind: p.kind,
    label: p.label,
    shape: p.shape,
    points: p.shape === "polygon" ? p.points ?? [] : null,
    center_lat: p.shape === "circle" ? p.center?.lat ?? null : null,
    center_lng: p.shape === "circle" ? p.center?.lng ?? null : null,
    radius_m: p.shape === "circle" ? p.radius ?? null : null,
    nivel: p.level ?? null,
    color: p.color ?? null,
  };
}

// --- controles de acceso ---
export function accesoFromApi(a: any): AccessControl {
  return {
    id: String(a.id),
    emergencyId: String(a.emergencia_id),
    kind: a.kind,
    label: a.label,
    state: a.estado,
    units: a.units ?? undefined,
    reason: a.reason ?? undefined,
    location: { lat: a.lat, lng: a.lng },
    createdAt: a.created_at,
    updatedAt: a.created_at,
  };
}

// --- cortes viales ---
export function corteFromApi(a: any): RoadBlock {
  return {
    id: String(a.id),
    emergencyId: String(a.emergencia_id),
    road: a.road,
    km: a.km ?? undefined,
    location:
      a.lat != null ? { lat: a.lat, lng: a.lng } : (a.segment?.from ?? { lat: 0, lng: 0 }),
    segment: a.segment ?? undefined,
    reason: a.reason ?? "",
    status: a.estado,
    createdAt: a.created_at,
  };
}

// --- incidencias ---
export function incidenciaFromApi(a: any): Incident {
  return {
    id: String(a.id),
    emergencyId: String(a.emergencia_id),
    title: a.title,
    type: a.tipo,
    severity: a.severity,
    status: a.estado,
    reportedAt: a.reported_at,
    location: { lat: a.lat ?? 0, lng: a.lng ?? 0 },
    description: a.description ?? "",
    assignedResources: [],
  };
}
