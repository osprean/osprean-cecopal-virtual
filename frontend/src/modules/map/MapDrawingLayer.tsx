import { useEffect, useMemo, useRef } from "react";
import { Polyline, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { useDrawingStore } from "../../store";
import type { GeoPoint } from "../../types";

// Capa que vive dentro de <MapContainer>. Captura los eventos del ratón cuando
// el modo de dibujo está activo, deshabilita el pan del mapa mientras se
// dibuja, y pinta los trazos guardados como Polyline (que sigue el zoom/pan).
export const MapDrawingLayer = ({ scope }: { scope?: string }) => {
  const map = useMap();
  const tool = useDrawingStore((s) => s.tool);
  const strokes = useDrawingStore((s) => s.strokes);
  const currentStroke = useDrawingStore((s) => s.currentStroke);
  const color = useDrawingStore((s) => s.color);
  const width = useDrawingStore((s) => s.width);
  const beginStroke = useDrawingStore((s) => s.beginStroke);
  const extendStroke = useDrawingStore((s) => s.extendStroke);
  const endStroke = useDrawingStore((s) => s.endStroke);
  const eraseStroke = useDrawingStore((s) => s.eraseStroke);
  const setScope = useDrawingStore((s) => s.setScope);

  const drawingRef = useRef(false);

  // Mantener el scope actual sincronizado para que los trazos nuevos lo
  // hereden.
  useEffect(() => {
    setScope(scope ?? null);
  }, [scope, setScope]);

  // Deshabilita el drag y el zoom-on-doubleclick mientras se está dibujando o
  // borrando. Cursor visual para indicar el modo.
  useEffect(() => {
    const container = map.getContainer();
    const active = tool !== "idle";
    if (active) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
      container.style.cursor = tool === "erase" ? "cell" : "crosshair";
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = "";
    }
    return () => {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = "";
    };
  }, [map, tool]);

  useMapEvents({
    mousedown: (e: LeafletMouseEvent) => {
      if (tool !== "draw") return;
      drawingRef.current = true;
      beginStroke({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mousemove: (e: LeafletMouseEvent) => {
      if (tool !== "draw" || !drawingRef.current) return;
      extendStroke({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mouseup: () => {
      if (tool !== "draw") return;
      drawingRef.current = false;
      endStroke();
    },
    mouseout: () => {
      if (drawingRef.current) {
        drawingRef.current = false;
        endStroke();
      }
    },
  });

  const visibleStrokes = useMemo(
    () =>
      scope
        ? strokes.filter((s) => !s.scope || s.scope === scope)
        : strokes,
    [strokes, scope],
  );

  const toLatLngs = (pts: GeoPoint[]): [number, number][] =>
    pts.map((p) => [p.lat, p.lng]);

  return (
    <>
      {visibleStrokes.map((stk) => (
        <Polyline
          key={stk.id}
          positions={toLatLngs(stk.points)}
          pathOptions={{
            color: stk.color,
            weight: stk.width,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
            // Marca los trazos de usuario para poder distinguirlos del resto
            // de overlays SVG durante la captura "solo dibujos".
            className: "tac-drawing-stroke",
          }}
          eventHandlers={{
            click: () => {
              if (tool === "erase") eraseStroke(stk.id);
            },
            mouseover: () => {
              if (tool === "erase") eraseStroke(stk.id);
            },
          }}
        />
      ))}
      {currentStroke && currentStroke.length >= 2 && (
        <Polyline
          positions={toLatLngs(currentStroke)}
          pathOptions={{
            color,
            weight: width,
            opacity: 0.8,
            dashArray: "6 4",
            lineCap: "round",
            lineJoin: "round",
            className: "tac-drawing-stroke",
          }}
        />
      )}
    </>
  );
};
