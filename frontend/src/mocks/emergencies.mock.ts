import type { Emergency } from "../types";

// Una sola emergencia activa: inicio de fuego provocado por accidente de
// tráfico cerca de El Álamo (Madrid). El icono del marcador será un coche
// estrellado (domain: "traffic-accident").
export const mockEmergencies: Emergency[] = [
  {
    id: "emg-001",
    code: "TRA-2026-0001",
    name: "Accidente de tráfico con inicio de fuego — El Álamo",
    domain: "traffic-accident",
    severity: "critical",
    status: "active",
    startedAt: "2026-05-18T09:00:00Z",
    updatedAt: "2026-05-18T09:05:00Z",
    location: { lat: 40.2295, lng: -4.0156 },
    area: null,
    affectedPopulation: 0,
    description:
      "Colisión de vehículo con inicio de fuego en las inmediaciones de El Álamo (Madrid). Pendiente de evaluación de heridos y propagación.",
    commandPost: undefined,
    responsibleAgency: undefined,
  },
];
