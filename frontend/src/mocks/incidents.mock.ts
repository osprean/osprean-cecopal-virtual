import type { Incident } from "../types";

// Incidencias abiertas derivadas de la emergencia de El Álamo (emg-001).
// Cada incidencia es un foco concreto sobre el terreno con recursos asignados.
export const mockIncidents: Incident[] = [
  {
    id: "inc-001",
    emergencyId: "emg-001",
    title: "Vehículo en llamas — M-507 km 14",
    type: "traffic-accident",
    severity: "critical",
    status: "active",
    reportedAt: "2026-05-18T09:01:00Z",
    location: { lat: 40.2295, lng: -4.0156 },
    description:
      "Turismo siniestrado con incendio declarado en el motor. Posible atrapado en plaza del copiloto.",
    assignedResources: ["res-001", "res-002"],
  },
  {
    id: "inc-002",
    emergencyId: "emg-001",
    title: "Triage de heridos en la calzada",
    type: "medical",
    severity: "high",
    status: "active",
    reportedAt: "2026-05-18T09:04:00Z",
    location: { lat: 40.2298, lng: -4.0159 },
    description:
      "Triage in situ: 1 herido crítico (politraumatismo + quemaduras), 2 heridos leves. Pendiente evacuación aérea.",
    assignedResources: ["res-003", "res-004"],
  },
  {
    id: "inc-003",
    emergencyId: "emg-001",
    title: "Corte de M-507 (ambos sentidos)",
    type: "security",
    severity: "high",
    status: "monitoring",
    reportedAt: "2026-05-18T09:06:00Z",
    location: { lat: 40.2310, lng: -4.0170 },
    description:
      "Cierre del tramo entre km 12 y km 16 — Guardia Civil regula desvío hacia M-501. Retención de 1,5 km.",
    assignedResources: ["res-005"],
  },
  {
    id: "inc-004",
    emergencyId: "emg-001",
    title: "Riesgo de propagación a vegetación de cuneta",
    type: "fire",
    severity: "medium",
    status: "monitoring",
    reportedAt: "2026-05-18T09:08:00Z",
    location: { lat: 40.2293, lng: -4.0152 },
    description:
      "Pavesas alcanzan vegetación seca de la cuneta. Equipo forestal en preventivo con mochila extintora.",
    assignedResources: ["res-006"],
  },
  {
    id: "inc-005",
    emergencyId: "emg-001",
    title: "Derrame de combustible",
    type: "chemical",
    severity: "medium",
    status: "active",
    reportedAt: "2026-05-18T09:10:00Z",
    location: { lat: 40.2296, lng: -4.0158 },
    description:
      "Mancha de hidrocarburos ~6 m² sobre asfalto. Solicitado equipo NRBQ + absorbente.",
    assignedResources: [],
  },
  {
    id: "inc-006",
    emergencyId: "emg-001",
    title: "Asistencia psicosocial a testigos",
    type: "other",
    severity: "low",
    status: "resolved",
    reportedAt: "2026-05-18T09:12:00Z",
    location: { lat: 40.2300, lng: -4.0163 },
    description:
      "Atención a 3 testigos en shock leve. Trasladados al punto de espera fuera del cordón.",
    assignedResources: ["res-007"],
  },
];
