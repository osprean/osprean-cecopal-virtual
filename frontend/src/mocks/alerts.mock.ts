import type { Alert } from "../types";

// Alertas entrantes ligadas a la emergencia activa de El Álamo (emg-001).
// Mock-up para que el panel de Alertas (Dirección/Sanitario) tenga contenido.
export const mockAlerts: Alert[] = [
  {
    id: "alr-001",
    emergencyId: "emg-001",
    source: "112 Madrid",
    severity: "critical",
    message:
      "Llamada entrante: colisión frontal con vehículo en llamas en M-507 km 14, sentido El Álamo. Posibles atrapados.",
    createdAt: "2026-05-18T09:01:00Z",
    acknowledged: false,
    location: { lat: 40.2295, lng: -4.0156 },
  },
  {
    id: "alr-002",
    emergencyId: "emg-001",
    source: "Guardia Civil de Tráfico",
    severity: "high",
    message:
      "Patrulla 14-Bravo confirma incendio en turismo y retención de 1,5 km. Solicita corte de vía y desvío por M-501.",
    createdAt: "2026-05-18T09:03:00Z",
    acknowledged: false,
    location: { lat: 40.2301, lng: -4.0162 },
  },
  {
    id: "alr-003",
    emergencyId: "emg-001",
    source: "Bomberos CAM · Parque Navalcarnero",
    severity: "high",
    message:
      "Salida B-12 + auto-bomba urbana en ruta. ETA estimada 8 min al punto de impacto.",
    createdAt: "2026-05-18T09:04:00Z",
    acknowledged: false,
  },
  {
    id: "alr-004",
    emergencyId: "emg-001",
    source: "SUMMA 112 · Mesa Sanitaria",
    severity: "medium",
    message:
      "Activadas 2 UVI móviles y SVB. Pendiente confirmación de número de heridos y triage en el lugar.",
    createdAt: "2026-05-18T09:05:30Z",
    acknowledged: false,
  },
  {
    id: "alr-005",
    emergencyId: null,
    source: "AEMET",
    severity: "info",
    message:
      "Aviso amarillo por viento (rachas 60 km/h) en la Comunidad de Madrid hasta las 18:00. Podría favorecer propagación.",
    createdAt: "2026-05-18T08:45:00Z",
    acknowledged: true,
  },
];
