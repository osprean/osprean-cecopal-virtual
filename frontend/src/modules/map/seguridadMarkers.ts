import L from "leaflet";
import { MdLocalPolice, MdLockOpen, MdReportProblem } from "react-icons/md";
import type { AccessControlKind, AccessControlState, Severity } from "../../types";
import { tacticalColors } from "../../theme/colors";
import { iconSvg } from "./iconSvg";

const STATE_COLOR: Record<AccessControlState, string> = {
  open: tacticalColors.state.operational,
  restricted: tacticalColors.state.alert,
  closed: tacticalColors.state.critical,
};

// Compact icon-only marker. Detail surfaces via leaflet <Tooltip> on hover.
export const createAccessControlMarker = (
  kind: AccessControlKind,
  state: AccessControlState,
) => {
  const color = STATE_COLOR[state];
  const glyph = kind === "checkpoint" ? MdLocalPolice : MdLockOpen;
  const html = `
    <div style="
      width: 30px; height: 30px;
      background: white;
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(glyph, color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-access-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const createDrawingPointMarker = (index: number) => {
  const color = tacticalColors.accent.teal;
  const html = `
    <div style="
      width: 18px; height: 18px;
      background: white;
      border: 2.5px solid ${color};
      border-radius: 50%;
      box-shadow: 0 0 0 3px ${color}22, 0 4px 8px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
      color: ${color};
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 900;
    ">${index + 1}</div>
  `;
  return L.divIcon({
    className: "tactical-drawing-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: tacticalColors.state.critical,
  high: tacticalColors.state.alert,
  medium: tacticalColors.state.pending,
  low: tacticalColors.state.offline,
  info: tacticalColors.state.active,
};

// Pin de incidencia reportada en el mapa — triángulo de aviso sobre disco
// blanco con anillo de severidad. Usado tanto por Seguridad como Sanitario.
export const createIncidentMarker = (severity: Severity) => {
  const color = SEVERITY_COLOR[severity];
  const html = `
    <div style="
      width: 30px; height: 30px;
      background: white;
      border: 2.5px solid ${color};
      border-radius: 50%;
      box-shadow: 0 0 0 4px ${color}1A, 0 4px 10px rgba(15, 22, 36, 0.20);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdReportProblem, color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-incident-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// Endpoint marker (A / B) for street closure flow.
export const createClosureEndpointMarker = (label: "A" | "B") => {
  const color = tacticalColors.state.critical;
  const html = `
    <div style="
      width: 22px; height: 22px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px ${color}55, 0 4px 10px rgba(15, 22, 36, 0.20);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
      color: white;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 900;
    ">${label}</div>
  `;
  return L.divIcon({
    className: "tactical-drawing-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};
