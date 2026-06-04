export type TabKey =
  | "direccion"
  | "seguridad"
  | "sanitario"
  | "logistica"
  | "gabinete"
  | "campo";

export interface TacticalTab {
  key: TabKey;
  label: string;
  shortLabel?: string;
  badge?: number | null;
  disabled?: boolean;
}
