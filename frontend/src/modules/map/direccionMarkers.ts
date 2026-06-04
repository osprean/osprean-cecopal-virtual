import L from "leaflet";
import {
  MdApartment,
  MdBlock,
  MdFlag,
  MdHome,
  MdOutlineDomain,
} from "react-icons/md";
import type { IconType } from "react-icons";
import type { CommandPostType, OperationalState, RoadBlockStatus } from "../../types";
import { tacticalColors } from "../../theme/colors";
import { iconSvg } from "./iconSvg";

const STATE_HEX: Record<OperationalState, string> = {
  critical: tacticalColors.state.critical,
  alert: tacticalColors.state.alert,
  pending: tacticalColors.state.pending,
  operational: tacticalColors.state.operational,
  active: tacticalColors.state.active,
  standby: tacticalColors.state.standby,
  offline: tacticalColors.state.offline,
};

const POST_ICON: Record<CommandPostType, IconType> = {
  PMA: MdFlag,
  CECOPAL: MdOutlineDomain,
  PCA: MdApartment,
};

export const createCommandPostMarker = (type: CommandPostType, state: OperationalState) => {
  const color = STATE_HEX[state];
  const html = `
    <div style="
      width: 32px; height: 32px;
      background: white;
      border: 2px solid ${color};
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(POST_ICON[type], color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-cp-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const createShelterMarker = (_name: string, occupancy: number, capacity: number) => {
  const ratio = capacity > 0 ? occupancy / capacity : 0;
  const color =
    ratio > 0.85
      ? tacticalColors.state.critical
      : ratio > 0.5
        ? tacticalColors.state.alert
        : tacticalColors.state.operational;
  const html = `
    <div style="
      width: 30px; height: 30px;
      background: white;
      border: 2px solid ${color};
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdHome, color, 18)}</div>
  `;
  return L.divIcon({
    className: "tactical-shelter-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

export const createRoadBlockMarker = (_road: string, status: RoadBlockStatus) => {
  const color =
    status === "active"
      ? tacticalColors.state.critical
      : status === "intermittent"
        ? tacticalColors.state.alert
        : tacticalColors.state.offline;
  const html = `
    <div style="
      width: 28px; height: 28px;
      background: white;
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(15, 22, 36, 0.18);
      transform: translate(-50%, -50%);
      display: flex; align-items: center; justify-content: center;
    ">${iconSvg(MdBlock, color, 16)}</div>
  `;
  return L.divIcon({
    className: "tactical-roadblock-marker",
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};
