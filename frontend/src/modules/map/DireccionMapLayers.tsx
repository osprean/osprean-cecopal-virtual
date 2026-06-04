import { LayersControl, LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import {
  createCommandPostMarker,
  createRoadBlockMarker,
  createShelterMarker,
} from "./direccionMarkers";
import { useDireccionStore } from "../../store";
import { tacticalColors } from "../../theme/colors";
import { SeguridadMapLayers } from "./SeguridadMapLayers";
import { SanitarioMapLayers } from "./SanitarioMapLayers";

// Renders inside <TacticalMap><DireccionMapLayers /></TacticalMap>.
// Adds: command posts (PMA/CECOPAL), shelters, road blocks, evacuation routes.
// Mirrors Seguridad and Sanidad layers in read-only mode so Dirección sees
// the full operational picture without being able to edit those scopes.
export const DireccionMapLayers = () => {
  const commandPosts = useDireccionStore((s) => s.commandPosts);
  const shelters = useDireccionStore((s) => s.shelters);
  const roadBlocks = useDireccionStore((s) => s.roadBlocks);
  const evacuations = useDireccionStore((s) => s.evacuations);

  return (
    <>
      <SeguridadMapLayers readOnly />
      <SanitarioMapLayers readOnly />

      <LayersControl.Overlay checked name="Puestos de Mando">
        <LayerGroup>
          {commandPosts.map((cp) => (
            <Marker
              key={cp.id}
              position={[cp.location.lat, cp.location.lng]}
              icon={createCommandPostMarker(cp.type, cp.state)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{cp.code}</strong> · {cp.type}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {cp.commanderName} · {cp.state.toUpperCase()}
                </div>
              </Tooltip>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Albergues">
        <LayerGroup>
          {shelters.map((sh) => (
            <Marker
              key={sh.id}
              position={[sh.location.lat, sh.location.lng]}
              icon={createShelterMarker(sh.name, sh.occupancy, sh.capacity)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{sh.name}</strong>
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  Ocupación {sh.occupancy} / {sh.capacity}
                </div>
              </Tooltip>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Cortes de vía">
        <LayerGroup>
          {roadBlocks.map((rb) => (
            <Marker
              key={rb.id}
              position={[rb.location.lat, rb.location.lng]}
              icon={createRoadBlockMarker(rb.road, rb.status)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{rb.road}</strong>
                {rb.km ? ` · PK ${rb.km}` : ""}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {rb.status.toUpperCase()} · {rb.reason}
                </div>
              </Tooltip>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Evacuaciones">
        <LayerGroup>
          {evacuations.map((ev) => (
            <Polyline
              key={ev.id}
              positions={ev.routePoints.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color:
                  ev.status === "in-progress"
                    ? tacticalColors.state.alert
                    : ev.status === "completed"
                      ? tacticalColors.state.operational
                      : tacticalColors.state.standby,
                weight: 3,
                opacity: 0.85,
                dashArray: ev.status === "in-progress" ? "8 6" : undefined,
              }}
            >
              <Tooltip direction="top" sticky opacity={0.95}>
                <strong>{ev.name}</strong> · {ev.status.toUpperCase()}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {ev.evacuatedPeople} / {ev.estimatedPeople} pers.
                </div>
              </Tooltip>
            </Polyline>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>
    </>
  );
};
