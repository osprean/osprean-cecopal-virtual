import { create } from "zustand";
import { persist } from "zustand/middleware";

// Capa base seleccionada globalmente — persistida en localStorage para que la
// elección del usuario se mantenga entre páginas y recargas.
interface MapLayerState {
  layerKey: string;
  setLayerKey: (key: string) => void;

  // Preferencia del usuario: ocultar el resto de markers cuando hay dibujo activo.
  hideWhileDrawing: boolean;
  setHideWhileDrawing: (v: boolean) => void;

  // Flag transitorio puesto por cada página al entrar/salir de modo dibujo.
  // No se persiste — se resetea al recargar.
  drawingActive: boolean;
  setDrawingActive: (v: boolean) => void;
}

export const useMapLayerStore = create<MapLayerState>()(
  persist(
    (set) => ({
      layerKey: "carto-light",
      setLayerKey: (layerKey) => set({ layerKey }),

      hideWhileDrawing: true,
      setHideWhileDrawing: (hideWhileDrawing) => set({ hideWhileDrawing }),

      drawingActive: false,
      setDrawingActive: (drawingActive) => set({ drawingActive }),
    }),
    {
      name: "em-map-base-layer",
      partialize: (s) => ({
        layerKey: s.layerKey,
        hideWhileDrawing: s.hideWhileDrawing,
      }),
    },
  ),
);

export const selectHideOtherMarkers = (s: MapLayerState) =>
  s.hideWhileDrawing && s.drawingActive;
