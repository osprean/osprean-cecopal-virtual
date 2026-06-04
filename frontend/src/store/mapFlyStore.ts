import { create } from "zustand";
import type { GeoPoint } from "../types";

// Petición de vuelo cinematográfico sobre el mapa. La consume MapFlyController
// (montado dentro de TacticalMap) cuando cambia el `nonce`.
//
// - `point`: un solo punto → flyTo(point, zoom)
// - `bounds`: lista de puntos → flyToBounds(bounds) con padding
//
// El nonce se incrementa en cada petición para que el efecto se dispare aunque
// el destino sea idéntico al anterior.

export interface MapFlyRequest {
  point?: GeoPoint;
  bounds?: GeoPoint[];
  zoom?: number;          // solo aplica con point
  durationSec?: number;   // duración de la animación (default 1.2)
}

interface MapFlyState {
  request: MapFlyRequest | null;
  nonce: number;
  flyToPoint: (point: GeoPoint, zoom?: number, durationSec?: number) => void;
  flyToBounds: (points: GeoPoint[], durationSec?: number) => void;
  clear: () => void;
}

export const useMapFlyStore = create<MapFlyState>((set) => ({
  request: null,
  nonce: 0,

  flyToPoint: (point, zoom = 17, durationSec = 1.2) =>
    set((s) => ({
      request: { point, zoom, durationSec },
      nonce: s.nonce + 1,
    })),

  flyToBounds: (points, durationSec = 1.4) =>
    set((s) => ({
      request: { bounds: points, durationSec },
      nonce: s.nonce + 1,
    })),

  clear: () => set({ request: null }),
}));
