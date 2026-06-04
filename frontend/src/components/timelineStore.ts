import { create } from "zustand";

export type TimelineSource =
  | "general"
  | "direccion"
  | "seguridad"
  | "sanitario"
  | "logistica"
  | "realtime";

interface TimelineState {
  open: boolean;
  activeSource: TimelineSource;
  setOpen: (v: boolean) => void;
  setActiveSource: (s: TimelineSource) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  open: false,
  activeSource: "general",
  setOpen: (open) => set({ open }),
  setActiveSource: (activeSource) => set({ activeSource }),
}));
