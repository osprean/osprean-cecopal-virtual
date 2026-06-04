import L from "leaflet";
import type { IconType } from "react-icons";
import {
  MdAirportShuttle,
  MdHealing,
  MdLocalHospital,
  MdMedicalServices,
  MdNightShelter,
  MdPerson,
} from "react-icons/md";
import type { AmbulanceState, HospitalLevel, SanitaryZoneKind, TriageColor } from "../../types";
import { tacticalColors } from "../../theme/colors";
import { iconSvg } from "./iconSvg";

const TRIAGE_COLOR: Record<TriageColor, string> = {
  red: tacticalColors.state.critical,
  yellow: tacticalColors.state.pending,
  green: tacticalColors.state.operational,
  black: "#1A202C",
  unset: tacticalColors.text.muted,
};

const AMB_STATE_COLOR: Record<AmbulanceState, string> = {
  available: tacticalColors.state.operational,
  dispatched: tacticalColors.state.alert,
  "on-scene": tacticalColors.state.critical,
  transporting: tacticalColors.state.active,
  "at-hospital": tacticalColors.state.standby,
  returning: tacticalColors.text.label,
  "out-of-service": tacticalColors.state.offline,
};

const HOSPITAL_COLOR: Record<HospitalLevel, string> = {
  primary: tacticalColors.state.active,
  general: tacticalColors.state.active,
  trauma: tacticalColors.state.critical,
  specialized: tacticalColors.state.standby,
};

const ZONE_ICON: Record<SanitaryZoneKind, IconType> = {
  "triage-point": MdMedicalServices,
  "first-aid": MdHealing,
  "morgue": MdNightShelter,
  "hospital-tent": MdLocalHospital,
};

export const createVictimMarker = (_code: string, triage: TriageColor) => {
  const color = TRIAGE_COLOR[triage];
  const html = `
    <div style="
      transform: translate(-50%, -50%);
      width: 28px; height: 28px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 6px;
      box-shadow: 0 0 0 2px ${color}55, 0 4px 10px rgba(15,22,36,0.18);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdPerson, "white", 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-marker",
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

export const createAmbulanceMarker = (_callSign: string, state: AmbulanceState) => {
  const color = AMB_STATE_COLOR[state];
  const html = `
    <div style="
      transform: translate(-50%, -50%);
      width: 30px; height: 30px;
      background: white;
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(15,22,36,0.18);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdAirportShuttle, color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-resource-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const createHospitalMarker = (
  _name: string,
  level: HospitalLevel,
  occupancyRatio: number,
) => {
  const baseColor = HOSPITAL_COLOR[level];
  const tone =
    occupancyRatio >= 0.9
      ? tacticalColors.state.critical
      : occupancyRatio >= 0.7
        ? tacticalColors.state.alert
        : baseColor;
  const html = `
    <div style="
      transform: translate(-50%, -50%);
      width: 32px; height: 32px;
      background: white;
      border: 2px solid ${tone};
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(15,22,36,0.18);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdLocalHospital, tone, 20)}</div>
  `;
  return L.divIcon({
    className: "tactical-resource-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const createSanitaryZoneMarker = (_label: string, kind: SanitaryZoneKind) => {
  const color = tacticalColors.accent.teal;
  const html = `
    <div style="
      transform: translate(-50%, -50%);
      width: 30px; height: 30px;
      background: white;
      border: 2px solid ${color};
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(15,22,36,0.18);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(ZONE_ICON[kind], color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-shelter-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};
