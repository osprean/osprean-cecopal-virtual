import L from "leaflet";
import type { IconType } from "react-icons";
import {
  MdLocalFireDepartment,
  MdLocalHospital,
  MdLocalPolice,
  MdLocalShipping,
  MdScience,
  MdVibration,
  MdWaterDrop,
  MdWarning,
} from "react-icons/md";
import type { EmergencyDomain, Severity } from "../../types";
import { tacticalColors } from "../../theme/colors";
import { iconSvg } from "./iconSvg";

const SEVERITY_HEX: Record<Severity, string> = {
  critical: tacticalColors.state.critical,
  high: tacticalColors.state.alert,
  medium: tacticalColors.state.pending,
  low: tacticalColors.state.offline,
  info: tacticalColors.state.active,
};

// Inline SVG explícito para accidente de tráfico: silueta de coche siniestrado
// con líneas de impacto. Se prefiere a react-icons aquí porque, a 18px y
// renderizado via renderToStaticMarkup, el icono de MD se leía como un
// símbolo ambiguo (parecía una interrogación). Este SVG no deja lugar a dudas.
const trafficAccidentSvg = (color: string, size: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
  style="display:block" fill="none" stroke="${color}" stroke-width="1.6"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M3.2 14.6l1.1-3.2a1.6 1.6 0 0 1 1.5-1.1h8.4a1.6 1.6 0 0 1 1.5 1.1l1.1 3.2v3.1a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-.9H6.8v.9a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8z" fill="${color}" fill-opacity="0.12"/>
  <path d="M5.6 14.6h11.4"/>
  <circle cx="7.4" cy="15.8" r="1.1" fill="${color}"/>
  <circle cx="14.6" cy="15.8" r="1.1" fill="${color}"/>
  <path d="M16.4 9.8l1.7-1.7M18.6 11.6l2.2-.6M18.6 8.4l1.9.5M14.8 7.2l.4-2"
    stroke-width="1.8"/>
</svg>`;

const DOMAIN_ICON: Record<EmergencyDomain, IconType> = {
  fire: MdLocalFireDepartment,
  flood: MdWaterDrop,
  medical: MdLocalHospital,
  seismic: MdVibration,
  chemical: MdScience,
  security: MdLocalPolice,
  "traffic-accident": MdWarning,
  other: MdWarning,
};

// Big rounded pin for emergencies — white inner with colored ring + domain icon.
export const createTacticalMarker = (severity: Severity, domain: EmergencyDomain) => {
  const color = SEVERITY_HEX[severity];
  const inner =
    domain === "traffic-accident"
      ? trafficAccidentSvg(color, 22)
      : iconSvg(DOMAIN_ICON[domain] ?? MdWarning, color, 18);
  const html = `
    <div style="
      transform: translate(-50%, -50%);
      width: 34px; height: 34px;
      background: white;
      border: 3px solid ${color};
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 4px ${color}1A, 0 6px 14px rgba(15, 22, 36, 0.18);
    ">${inner}</div>
  `;
  return L.divIcon({
    className: "tactical-marker",
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

// White circle with truck icon + small callsign chip on hover via Tooltip.
export const createResourceMarker = (_callSign: string) => {
  const color = tacticalColors.accent.tealDeep;
  const html = `
    <div style="
      width: 28px; height: 28px;
      background: white;
      border: 2px solid ${tacticalColors.accent.teal};
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdLocalShipping, color, 16)}</div>
  `;
  return L.divIcon({
    className: "tactical-resource-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};
