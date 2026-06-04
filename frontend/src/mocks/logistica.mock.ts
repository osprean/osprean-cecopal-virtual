import type {
  InfrastructureService,
  LogisticsActivity,
  LogisticsRequest,
  Machinery,
  SupplyItem,
  Vehicle,
} from "../types";

export const mockSupplies: SupplyItem[] = [];

export const mockVehicles: Vehicle[] = [];

export const mockMachinery: Machinery[] = [];

export const mockServices: InfrastructureService[] = [];

// Solicitudes logísticas activas alrededor de la emergencia emg-001.
export const mockLogisticsRequests: LogisticsRequest[] = [
  {
    id: "lreq-001",
    emergencyId: "emg-001",
    requestedBy: "PMA-Norte-01 · Intervención",
    category: "water",
    itemName: "Agua embotellada 1.5 L",
    quantity: 200,
    unit: "L",
    priority: "high",
    status: "in-transit",
    destination: "PMA M-507 km 14 · El Álamo",
    requestedAt: "2026-05-18T09:07:00Z",
    decidedAt: "2026-05-18T09:08:00Z",
    eta: "2026-05-18T09:20:00Z",
    notes: "Hidratación para equipos en zona caliente.",
  },
  {
    id: "lreq-002",
    emergencyId: "emg-001",
    requestedBy: "Sanitario · SUMMA",
    category: "medical",
    itemName: "Material de quemados (sueros, apósitos)",
    quantity: 1,
    unit: "lote",
    priority: "critical",
    status: "pending",
    destination: "PMA M-507 km 14 · El Álamo",
    requestedAt: "2026-05-18T09:09:00Z",
    notes: "Triage rojo en curso. Confirmar disponibilidad en Almacén 1.",
  },
  {
    id: "lreq-003",
    emergencyId: "emg-001",
    requestedBy: "Intervención · Bomberos CAM",
    category: "ppe",
    itemName: "Mascarillas FFP3",
    quantity: 50,
    unit: "ud",
    priority: "medium",
    status: "approved",
    destination: "PMA M-507 km 14 · El Álamo",
    requestedAt: "2026-05-18T09:10:00Z",
    decidedAt: "2026-05-18T09:11:00Z",
    eta: "2026-05-18T09:30:00Z",
  },
  {
    id: "lreq-004",
    emergencyId: "emg-001",
    requestedBy: "Logística · Base Robledo",
    category: "fuel",
    itemName: "Gasóleo B (cisterna)",
    quantity: 500,
    unit: "L",
    priority: "low",
    status: "delivered",
    destination: "Generadores PMA",
    requestedAt: "2026-05-18T08:55:00Z",
    decidedAt: "2026-05-18T08:57:00Z",
    eta: "2026-05-18T09:15:00Z",
  },
];

export const mockLogisticsActivities: LogisticsActivity[] = [
  {
    id: "lact-001",
    type: "request-created",
    message: "Nueva solicitud: 1 lote de material de quemados → PMA El Álamo.",
    performedBy: "Coord. Romero · LOG",
    timestamp: "2026-05-18T09:09:10Z",
    refId: "lreq-002",
  },
  {
    id: "lact-002",
    type: "request-approved",
    message: "Aprobada solicitud de 50 mascarillas FFP3 para Intervención.",
    performedBy: "Coord. Romero · LOG",
    timestamp: "2026-05-18T09:11:00Z",
    refId: "lreq-003",
  },
  {
    id: "lact-003",
    type: "vehicle-assigned",
    message: "VAN-204 asignada al envío de agua embotellada (lreq-001).",
    performedBy: "Coord. Romero · LOG",
    timestamp: "2026-05-18T09:08:30Z",
    refId: "lreq-001",
  },
  {
    id: "lact-004",
    type: "request-delivered",
    message: "Entregados 500 L de gasóleo B en PMA (generadores).",
    performedBy: "Conductor Núñez · CIS-12",
    timestamp: "2026-05-18T09:15:00Z",
    refId: "lreq-004",
  },
];
