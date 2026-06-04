import { create } from "zustand";
import type { GeoPoint } from "../types";

// Vista compartida entre pestañas. Cada TacticalMap escribe el center+zoom en
// el "moveend" del mapa y los recupera al volver a montarse — así al cambiar
// de Seguridad → Sanitario → Seguridad la cámara se queda donde la dejaste.
//
// userLocation: posición del operador (browser geolocation). Si está
// disponible, los mapas la usan como centro inicial cuando aún no se ha
// guardado view en esta sesión.

interface MapViewState {
  view: { center: GeoPoint; zoom: number } | null;
  userLocation: GeoPoint | null;
  setView: (center: GeoPoint, zoom: number) => void;
  setUserLocation: (loc: GeoPoint | null) => void;
}

export const useMapViewStore = create<MapViewState>((set) => ({
  view: null,
  userLocation: null,
  setView: (center, zoom) => set({ view: { center, zoom } }),
  setUserLocation: (userLocation) => set({ userLocation }),
}));
