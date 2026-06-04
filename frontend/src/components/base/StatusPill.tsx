import type { Severity, Status, OperationalState } from "../../types";
import { StatusBadge } from "./StatusBadge";

// Bridge from domain Severity / Status to the operational state visual system.
// Kept for backward-compat with code written before StatusBadge existed.
const SEVERITY_TO_STATE: Record<Severity, OperationalState> = {
  critical: "critical",
  high: "alert",
  medium: "pending",
  low: "offline",
  info: "active",
};

const STATUS_TO_STATE: Record<Status, OperationalState> = {
  active: "critical",
  monitoring: "alert",
  dispatched: "active",
  standby: "standby",
  resolved: "operational",
};

type LegacyVariant = "critical" | "warning" | "ok" | "info" | "neutral";

const LEGACY_TO_STATE: Record<LegacyVariant, OperationalState> = {
  critical: "critical",
  warning: "alert",
  ok: "operational",
  info: "active",
  neutral: "offline",
};

interface StatusPillProps {
  severity?: Severity;
  status?: Status;
  variant?: LegacyVariant;
  label?: string;
}

export const StatusPill = ({ severity, status, variant, label }: StatusPillProps) => {
  const state: OperationalState = variant
    ? LEGACY_TO_STATE[variant]
    : severity
      ? SEVERITY_TO_STATE[severity]
      : status
        ? STATUS_TO_STATE[status]
        : "offline";

  return <StatusBadge state={state} size="xs" variant="subtle" label={label} />;
};
