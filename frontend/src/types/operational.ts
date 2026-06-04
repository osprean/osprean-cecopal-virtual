// Operational states drive the visual system across all tactical components.
// Each state maps deterministically to color, icon and motion behavior.
export type OperationalState =
  | "critical"     // crítico — red, pulse
  | "alert"        // alerta — orange
  | "operational"  // operativo — green
  | "active"       // activo — blue
  | "pending"      // pendiente — yellow
  | "standby"      // standby — purple
  | "offline";     // desconectado — gray

export const OPERATIONAL_LABEL: Record<OperationalState, string> = {
  critical: "CRÍTICO",
  alert: "ALERTA",
  operational: "OPERATIVO",
  active: "ACTIVO",
  pending: "PENDIENTE",
  standby: "STANDBY",
  offline: "DESCONECTADO",
};

export const OPERATIONAL_COLOR_SCHEME: Record<OperationalState, string> = {
  critical: "red",
  alert: "orange",
  operational: "green",
  active: "blue",
  pending: "yellow",
  standby: "purple",
  offline: "gray",
};
