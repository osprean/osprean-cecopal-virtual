import { useEffect } from "react";
import {
  Circle,
  LayerGroup,
  LayersControl,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  selectActiveClosures,
  selectActivePerimeters,
  selectHideOtherMarkers,
  useIncidentsStore,
  useMapLayerStore,
  useSeguridadStore,
} from "../../store";
import { PopupCard } from "./PopupCard";
import { tacticalColors } from "../../theme/colors";
import type { Perimeter, PerimeterKind } from "../../types";
import { createRoadBlockMarker } from "./direccionMarkers";
import {
  createAccessControlMarker,
  createClosureEndpointMarker,
  createDrawingPointMarker,
  createIncidentMarker,
} from "./seguridadMarkers";

const PERIMETER_COLOR: Record<PerimeterKind, string> = {
  exclusion: tacticalColors.state.critical,
  evacuation: tacticalColors.state.alert,
  safety: tacticalColors.state.pending,
  buffer: tacticalColors.state.active,
};

const perimeterStroke = (p: Perimeter) => {
  const color = p.color ?? PERIMETER_COLOR[p.kind];
  return {
    color,
    weight: p.level === 3 ? 3 : p.level === 2 ? 2.2 : 1.6,
    opacity: 0.95,
    fillColor: color,
    fillOpacity: p.kind === "exclusion" ? 0.18 : 0.1,
    dashArray: p.kind === "evacuation" ? "8 6" : p.kind === "safety" ? "4 4" : undefined,
  };
};

// Captures map clicks while a drawing mode is active.
const ClickCapture = () => {
  const mode = useSeguridadStore((s) => s.mode);
  const perimeterShape = useSeguridadStore((s) => s.perimeterShape);
  const circleCenter = useSeguridadStore((s) => s.circleCenter);
  const circleRadius = useSeguridadStore((s) => s.circleRadius);
  const addPoint = useSeguridadStore((s) => s.addDrawingPoint);
  const setPending = useSeguridadStore((s) => s.setPendingPoint);
  const setCircleCenter = useSeguridadStore((s) => s.setCircleCenter);
  const setCircleRadius = useSeguridadStore((s) => s.setCircleRadius);
  const setCirclePreviewRadius = useSeguridadStore((s) => s.setCirclePreviewRadius);

  const map = useMap();

  useMapEvents({
    click(e) {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (mode === "perimeter") {
        if (perimeterShape === "circle") {
          if (!circleCenter) {
            // 1er click: fija el centro.
            setCircleCenter(point);
            setCircleRadius(0);
            setCirclePreviewRadius(0);
          } else if (circleRadius === 0) {
            // 2º click: fija el radio según la distancia al centro.
            const r = map.distance(
              [circleCenter.lat, circleCenter.lng],
              [point.lat, point.lng],
            );
            setCircleRadius(r);
          }
          return;
        }
        addPoint(point);
      } else if (mode === "closure") {
        addPoint(point);
      } else if (mode === "checkpoint" || mode === "access" || mode === "incident") {
        setPending(point);
      }
    },
    mousemove(e) {
      // Preview del radio mientras se mueve el ratón antes del 2º click.
      if (
        mode === "perimeter" &&
        perimeterShape === "circle" &&
        circleCenter &&
        circleRadius === 0
      ) {
        const r = map.distance(
          [circleCenter.lat, circleCenter.lng],
          [e.latlng.lat, e.latlng.lng],
        );
        setCirclePreviewRadius(r);
      }
    },
  });

  // Crosshair cursor while drawing
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = mode === "idle" ? "" : "crosshair";
    return () => {
      container.style.cursor = "";
    };
  }, [map, mode]);

  return null;
};

const formatMeters = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 m";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
};

const DrawingPreview = () => {
  const mode = useSeguridadStore((s) => s.mode);
  const points = useSeguridadStore((s) => s.drawingPoints);
  const perimeterShape = useSeguridadStore((s) => s.perimeterShape);
  const circleCenter = useSeguridadStore((s) => s.circleCenter);
  const circleRadius = useSeguridadStore((s) => s.circleRadius);
  const previewRadius = useSeguridadStore((s) => s.circlePreviewRadius);

  if (mode === "perimeter" && perimeterShape === "circle" && circleCenter) {
    const effective = circleRadius > 0 ? circleRadius : previewRadius;
    return (
      <>
        <Circle
          center={[circleCenter.lat, circleCenter.lng]}
          radius={Math.max(effective, 1)}
          pathOptions={{
            color: tacticalColors.accent.teal,
            weight: 2,
            dashArray: circleRadius > 0 ? undefined : "6 4",
            fillColor: tacticalColors.accent.teal,
            fillOpacity: 0.12,
          }}
        >
          <Tooltip
            permanent
            direction="center"
            opacity={0.95}
            className="seguridad-circle-radius-tooltip"
          >
            Radio: <strong>{formatMeters(effective)}</strong>
          </Tooltip>
        </Circle>
        <Marker
          position={[circleCenter.lat, circleCenter.lng]}
          icon={createDrawingPointMarker(0)}
          interactive={false}
        />
      </>
    );
  }

  if (mode === "perimeter" && points.length > 0) {
    const positions = points.map((p) => [p.lat, p.lng]) as [number, number][];
    return (
      <>
        {positions.length >= 3 ? (
          <Polygon
            positions={positions}
            pathOptions={{
              color: tacticalColors.accent.teal,
              weight: 2,
              dashArray: "6 4",
              fillColor: tacticalColors.accent.teal,
              fillOpacity: 0.12,
            }}
          />
        ) : positions.length === 2 ? (
          <Polyline
            positions={positions}
            pathOptions={{
              color: tacticalColors.accent.teal,
              weight: 2,
              dashArray: "6 4",
            }}
          />
        ) : null}
        {positions.map((pos, i) => (
          <Marker key={`drawing-${i}`} position={pos} icon={createDrawingPointMarker(i)} />
        ))}
      </>
    );
  }

  if (mode === "closure" && points.length > 0) {
    const positions = points.map((p) => [p.lat, p.lng]) as [number, number][];
    return (
      <>
        {positions.length === 2 && (
          <Polyline
            positions={positions}
            pathOptions={{
              color: tacticalColors.state.critical,
              weight: 7,
              opacity: 0.85,
              lineCap: "round",
            }}
          />
        )}
        {positions.map((pos, i) => (
          <Marker
            key={`closure-pt-${i}`}
            position={pos}
            icon={createClosureEndpointMarker(i === 0 ? "A" : "B")}
          />
        ))}
      </>
    );
  }

  return null;
};

export const SeguridadMapLayers = ({ readOnly = false }: { readOnly?: boolean } = {}) => {
  const perimeters = useSeguridadStore(selectActivePerimeters);
  const accessControls = useSeguridadStore((s) => s.accessControls);
  const closures = useSeguridadStore(selectActiveClosures);
  const removePerimeter = useSeguridadStore((s) => s.removePerimeter);
  const removeAccessControl = useSeguridadStore((s) => s.removeAccessControl);
  const removeClosure = useSeguridadStore((s) => s.removeClosure);
  const hideOthers = useMapLayerStore(selectHideOtherMarkers);
  // Sólo incidencias creadas desde el flujo de Seguridad (type === "security").
  // Otras incidencias (sanitarias, tráfico, etc.) se renderizan en sus capas.
  const securityIncidents = useIncidentsStore((s) =>
    s.incidents.filter((i) => i.type === "security"),
  );
  const setIncidentStatus = useIncidentsStore((s) => s.setIncidentStatus);

  return (
    <>
      {!readOnly && <ClickCapture />}

      {!hideOthers && (
        <>
      <LayersControl.Overlay checked name="Perímetros">
        <LayerGroup>
          {perimeters.map((p) => {
            const isCircle = p.shape === "circle" && p.center && p.radius;
            const tooltip = (
              <Tooltip direction="top" sticky opacity={0.95}>
                <strong>{p.label}</strong> · {p.kind.toUpperCase()} · Nivel {p.level}
                {isCircle ? ` · Radio ${formatMeters(p.radius ?? 0)}` : ""}
              </Tooltip>
            );
            const popup = (
              <Popup>
                <PopupCard
                  kicker={`PERÍMETRO · ${p.kind.toUpperCase()}`}
                  title={p.label}
                  rows={[
                    ["Nivel", `Nivel ${p.level}`],
                    ["Estado", p.status.toUpperCase()],
                    isCircle
                      ? (["Radio", formatMeters(p.radius ?? 0)] as [string, string])
                      : (["Vértices", String(p.points.length)] as [string, string]),
                  ]}
                  onDelete={readOnly ? undefined : () => removePerimeter(p.id)}
                />
              </Popup>
            );
            if (isCircle && p.center && p.radius) {
              return (
                <Circle
                  key={p.id}
                  center={[p.center.lat, p.center.lng]}
                  radius={p.radius}
                  pathOptions={perimeterStroke(p)}
                >
                  {tooltip}
                  {popup}
                </Circle>
              );
            }
            return (
              <Polygon
                key={p.id}
                positions={p.points.map((pt) => [pt.lat, pt.lng])}
                pathOptions={perimeterStroke(p)}
              >
                {tooltip}
                {popup}
              </Polygon>
            );
          })}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Accesos / Controles">
        <LayerGroup>
          {accessControls.map((ac) => (
            <Marker
              key={ac.id}
              position={[ac.location.lat, ac.location.lng]}
              icon={createAccessControlMarker(ac.kind, ac.state)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{ac.label}</strong> · {ac.state.toUpperCase()}
                {ac.units != null ? ` · ${ac.units} ef.` : ""}
                {ac.reason ? <div style={{ fontSize: 10, opacity: 0.8 }}>{ac.reason}</div> : null}
              </Tooltip>
              <Popup>
                <PopupCard
                  kicker={ac.kind === "checkpoint" ? "CONTROL" : "ACCESO"}
                  title={ac.label}
                  rows={[
                    ["Estado", ac.state.toUpperCase()],
                    ...(ac.units != null ? ([["Efectivos", String(ac.units)]] as [string, string][]) : []),
                    ...(ac.reason ? ([["Motivo", ac.reason]] as [string, string][]) : []),
                  ]}
                  onDelete={readOnly ? undefined : () => removeAccessControl(ac.id)}
                />
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Calles cortadas">
        <LayerGroup>
          {closures.map((c) => (
            <ClosureRender
              key={c.id}
              closure={c}
              onDelete={readOnly ? undefined : () => removeClosure(c.id)}
            />
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Incidencias">
        <LayerGroup>
          {securityIncidents.map((inc) => (
            <Marker
              key={inc.id}
              position={[inc.location.lat, inc.location.lng]}
              icon={createIncidentMarker(inc.severity)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{inc.title}</strong> · {inc.severity.toUpperCase()}
                {inc.description ? (
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{inc.description}</div>
                ) : null}
              </Tooltip>
              <Popup>
                <PopupCard
                  kicker={`INCIDENCIA · ${inc.status.toUpperCase()}`}
                  title={inc.title}
                  rows={[
                    ["Severidad", inc.severity.toUpperCase()],
                    ["Estado", inc.status.toUpperCase()],
                    ["Reportada", new Date(inc.reportedAt).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })],
                    ...(inc.description ? ([["Detalle", inc.description]] as [string, string][]) : []),
                  ]}
                  onDelete={readOnly ? undefined : () => setIncidentStatus(inc.id, "resolved")}
                />
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>
        </>
      )}

      {!readOnly && <DrawingPreview />}
    </>
  );
};

const ClosureRender = ({
  closure,
  onDelete,
}: {
  closure: ReturnType<typeof useSeguridadStore.getState>["closures"][number];
  onDelete?: () => void;
}) => {
  const color =
    closure.status === "active"
      ? tacticalColors.state.critical
      : tacticalColors.state.alert;
  const tooltip = (
    <Tooltip direction="top" offset={[0, -14]} sticky opacity={0.95}>
      <strong>{closure.road}</strong>
      {closure.km ? ` · PK ${closure.km}` : ""}
      <div style={{ fontSize: 10, opacity: 0.8 }}>{closure.reason}</div>
    </Tooltip>
  );
  const popup = (
    <Popup>
      <PopupCard
        kicker={`CALLE CORTADA · ${closure.status.toUpperCase()}`}
        title={closure.road}
        rows={[
          ...(closure.km ? ([["PK", closure.km]] as [string, string][]) : []),
          ["Motivo", closure.reason],
          ["Creado", new Date(closure.createdAt).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })],
        ]}
        onDelete={onDelete}
      />
    </Popup>
  );
  if (closure.segment) {
    const positions: [number, number][] = [
      [closure.segment.from.lat, closure.segment.from.lng],
      [closure.segment.to.lat, closure.segment.to.lng],
    ];
    return (
      <>
        <Polyline
          positions={positions}
          pathOptions={{
            color,
            weight: 7,
            opacity: 0.85,
            lineCap: "round",
          }}
        >
          {tooltip}
          {popup}
        </Polyline>
        <Marker
          position={[closure.location.lat, closure.location.lng]}
          icon={createRoadBlockMarker(closure.road, closure.status)}
        >
          {tooltip}
          {popup}
        </Marker>
      </>
    );
  }
  return (
    <Marker
      position={[closure.location.lat, closure.location.lng]}
      icon={createRoadBlockMarker(closure.road, closure.status)}
    >
      {tooltip}
      {popup}
    </Marker>
  );
};
