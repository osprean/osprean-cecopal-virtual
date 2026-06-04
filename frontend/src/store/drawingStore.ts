import { create } from "zustand";
import type { GeoPoint } from "../types";

// Modos del dibujador a mano alzada:
//   idle  → mapa funciona con normalidad
//   draw  → cada arrastre crea un trazo nuevo
//   erase → al pasar el cursor sobre un trazo lo elimina (goma)
export type DrawingTool = "idle" | "draw" | "erase";

export interface DrawingStroke {
  id: string;
  // Coordenadas en lat/lng para que el trazo siga el mapa al hacer pan/zoom.
  points: GeoPoint[];
  color: string;
  width: number;
  // Scope opcional para limitar trazos a una página concreta.
  scope?: string;
}

interface DrawingState {
  tool: DrawingTool;
  color: string;
  width: number;
  scope: string | null;
  strokes: DrawingStroke[];
  currentStroke: GeoPoint[] | null;

  setTool: (tool: DrawingTool) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;
  setScope: (scope: string | null) => void;

  beginStroke: (point: GeoPoint) => void;
  extendStroke: (point: GeoPoint) => void;
  endStroke: () => void;

  eraseStroke: (id: string) => void;
  undo: () => void;
  clear: () => void;
}

const newId = () =>
  `stk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const useDrawingStore = create<DrawingState>((set, get) => ({
  tool: "idle",
  color: "#E53E3E",
  width: 4,
  scope: null,
  strokes: [],
  currentStroke: null,

  setTool: (tool) => set({ tool, currentStroke: null }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  setScope: (scope) => set({ scope }),

  beginStroke: (point) => {
    if (get().tool !== "draw") return;
    set({ currentStroke: [point] });
  },

  extendStroke: (point) => {
    const cs = get().currentStroke;
    if (!cs) return;
    // Drop redundant points to keep arrays small.
    const last = cs[cs.length - 1];
    if (last && Math.abs(last.lat - point.lat) < 1e-6 && Math.abs(last.lng - point.lng) < 1e-6) {
      return;
    }
    set({ currentStroke: [...cs, point] });
  },

  endStroke: () => {
    const { currentStroke, color, width, scope } = get();
    if (!currentStroke || currentStroke.length < 2) {
      set({ currentStroke: null });
      return;
    }
    const stroke: DrawingStroke = {
      id: newId(),
      points: currentStroke,
      color,
      width,
      scope: scope ?? undefined,
    };
    set((s) => ({ strokes: [...s.strokes, stroke], currentStroke: null }));
  },

  eraseStroke: (id) =>
    set((s) => ({ strokes: s.strokes.filter((stk) => stk.id !== id) })),

  undo: () =>
    set((s) => ({
      strokes: s.strokes.slice(0, -1),
      currentStroke: null,
    })),

  clear: () => set({ strokes: [], currentStroke: null }),
}));
