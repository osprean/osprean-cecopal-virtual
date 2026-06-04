import type { IconType } from "react-icons";
import {
  FaExclamationTriangle,
  FaBolt,
  FaCheckCircle,
  FaPlayCircle,
  FaHourglassHalf,
  FaPauseCircle,
  FaPowerOff,
} from "react-icons/fa";
import type { OperationalState } from "../../types";

export interface StateVisualConfig {
  fg: string;          // foreground / accent token
  bg: string;          // background soft token
  solid: string;       // solid background for filled badges
  icon: IconType;
  pulse?: boolean;     // animate?
}

export const STATE_VISUAL: Record<OperationalState, StateVisualConfig> = {
  critical: {
    fg: "state.critical",
    bg: "state.criticalSoft",
    solid: "state.critical",
    icon: FaExclamationTriangle,
    pulse: true,
  },
  alert: {
    fg: "state.alert",
    bg: "state.alertSoft",
    solid: "state.alert",
    icon: FaBolt,
    pulse: true,
  },
  operational: {
    fg: "state.operational",
    bg: "state.operationalSoft",
    solid: "state.operational",
    icon: FaCheckCircle,
  },
  active: {
    fg: "state.active",
    bg: "state.activeSoft",
    solid: "state.active",
    icon: FaPlayCircle,
  },
  pending: {
    fg: "state.pending",
    bg: "state.pendingSoft",
    solid: "state.pending",
    icon: FaHourglassHalf,
  },
  standby: {
    fg: "state.standby",
    bg: "state.standbySoft",
    solid: "state.standby",
    icon: FaPauseCircle,
  },
  offline: {
    fg: "state.offline",
    bg: "state.offlineSoft",
    solid: "state.offline",
    icon: FaPowerOff,
  },
};
