import type {
  CommandPost,
  Communique,
  DirectorAction,
  Evacuation,
  GroupStatus,
  MediaRequest,
  RoadBlock,
  Shelter,
} from "../types";

const EMG = "emg-001";

export const mockCommandPosts: CommandPost[] = [];

export const mockGroups: GroupStatus[] = [];

// Solicitudes de medios entrantes al Director del Plan (PMA → CECOPAL).
// Pendientes y resueltas, para que el panel de SOLICITUDES tenga contenido.
export const mockMediaRequests: MediaRequest[] = [
  {
    id: "mreq-001",
    emergencyId: EMG,
    requestedBy: "PMA-Norte-01 · Jefe Intervención",
    resourceType: "fire-truck",
    quantity: 1,
    reason:
      "Refuerzo de auto-bomba urbana para sofocar vehículo en llamas y prevenir propagación a vegetación de la cuneta.",
    priority: "critical",
    status: "pending",
    requestedAt: "2026-05-18T09:04:00Z",
  },
  {
    id: "mreq-002",
    emergencyId: EMG,
    requestedBy: "Coordinador Sanitario · SUMMA",
    resourceType: "ambulance",
    quantity: 2,
    reason:
      "Solicita 2 UVI móviles adicionales por número estimado de heridos en triage rojo.",
    priority: "high",
    status: "pending",
    requestedAt: "2026-05-18T09:06:00Z",
  },
  {
    id: "mreq-003",
    emergencyId: EMG,
    requestedBy: "PMA-Norte-01 · Mando Operativo",
    resourceType: "helicopter",
    quantity: 1,
    reason:
      "Evacuación aérea de herido crítico al Hospital 12 de Octubre — accesos terrestres con retención.",
    priority: "critical",
    status: "approved",
    requestedAt: "2026-05-18T09:08:00Z",
    decidedAt: "2026-05-18T09:09:30Z",
    eta: "2026-05-18T09:22:00Z",
  },
  {
    id: "mreq-004",
    emergencyId: EMG,
    requestedBy: "Guardia Civil de Tráfico · Pat. 14-B",
    resourceType: "police-unit",
    quantity: 2,
    reason:
      "Refuerzo para cierre de M-507 (ambos sentidos) y regulación de tráfico en desvío por M-501.",
    priority: "high",
    status: "approved",
    requestedAt: "2026-05-18T09:05:00Z",
    decidedAt: "2026-05-18T09:06:00Z",
    eta: "2026-05-18T09:18:00Z",
  },
  {
    id: "mreq-005",
    emergencyId: EMG,
    requestedBy: "Logística · Base Robledo",
    resourceType: "supplies",
    quantity: 200,
    reason:
      "200 L de agua embotellada + EPI básicos (mascarillas FFP3, guantes) para equipos en zona caliente.",
    priority: "medium",
    status: "delivered",
    requestedAt: "2026-05-18T09:07:00Z",
    decidedAt: "2026-05-18T09:08:00Z",
    eta: "2026-05-18T09:20:00Z",
  },
];

// Historial de comunicados — mock-up para Gabinete (no se ve en el mapa).
export const mockCommuniques: Communique[] = [
  {
    id: "com-501",
    emergencyId: EMG,
    title: "Aviso a población — corte de tráfico M-507 (El Álamo)",
    body: "Se informa del cierre temporal del acceso a El Álamo por accidente con vehículo incendiado. Eviten la zona y sigan indicaciones del 112.",
    audience: "population",
    status: "pending-approval",
    createdBy: "Gabinete Comunicación",
    createdAt: "2026-05-18T09:08:00Z",
  },
  {
    id: "com-502",
    emergencyId: EMG,
    title: "Nota de prensa — accidente con incendio en El Álamo",
    body: "Accidente de tráfico con inicio de fuego en las inmediaciones de El Álamo. Servicios de emergencia desplazados. Se ampliará información.",
    audience: "press",
    status: "draft",
    createdBy: "Gabinete Comunicación",
    createdAt: "2026-05-18T09:10:00Z",
  },
  {
    id: "com-503",
    emergencyId: EMG,
    title: "Comunicado interno — activación de protocolo",
    body: "Se activa protocolo de respuesta ante accidente con riesgo de incendio. Solicita coordinación con Bomberos CAM y Guardia Civil de Tráfico.",
    audience: "authorities",
    status: "sent",
    createdBy: "Director Plan",
    createdAt: "2026-05-18T09:05:00Z",
    approvedAt: "2026-05-18T09:06:00Z",
    sentAt: "2026-05-18T09:07:00Z",
  },
];

export const mockShelters: Shelter[] = [];

export const mockEvacuations: Evacuation[] = [];

export const mockRoadBlocks: RoadBlock[] = [];

export const mockDirectorActions: DirectorAction[] = [];
