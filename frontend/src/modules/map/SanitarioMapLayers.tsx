import { useEffect } from "react";
import {
  LayerGroup,
  LayersControl,
  Marker,
  Polyline,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  selectHideOtherMarkers,
  useMapLayerStore,
  useSanitarioStore,
} from "../../store";
import { tacticalColors } from "../../theme/colors";
import {
  createAmbulanceMarker,
  createHospitalMarker,
  createSanitaryZoneMarker,
  createVictimMarker,
} from "./sanitarioMarkers";
import { PopupCard } from "./PopupCard";

const ZONE_KICKER: Record<string, string> = {
  "triage-point": "PUNTO DE TRIAJE",
  "first-aid": "ÁREA DE SOCORRO",
  morgue: "MORGUE PROVISIONAL",
  "hospital-tent": "TIENDA HOSPITAL",
};

const TRIAGE_LABEL: Record<string, string> = {
  red: "ROJO · URGENTE",
  yellow: "AMARILLO · DIFERIDO",
  green: "VERDE · LEVE",
  black: "NEGRO · FALLECIDO",
  unset: "SIN CLASIFICAR",
};

const AMB_STATE: Record<string, string> = {
  available: "DISPONIBLE",
  dispatched: "EN RUTA",
  transporting: "TRANSPORTANDO",
  "at-hospital": "EN HOSPITAL",
  "out-of-service": "FUERA DE SERVICIO",
};

const ClickCapture = () => {
  const mode = useSanitarioStore((s) => s.mode);
  const setPending = useSanitarioStore((s) => s.setPendingPoint);
  const map = useMap();

  useMapEvents({
    click(e) {
      if (mode === "idle") return;
      setPending({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  useEffect(() => {
    map.getContainer().style.cursor = mode === "idle" ? "" : "crosshair";
    return () => {
      map.getContainer().style.cursor = "";
    };
  }, [map, mode]);

  return null;
};

export const SanitarioMapLayers = ({ readOnly = false }: { readOnly?: boolean } = {}) => {
  const victims = useSanitarioStore((s) => s.victims);
  const ambulances = useSanitarioStore((s) => s.ambulances);
  const hospitals = useSanitarioStore((s) => s.hospitals);
  const zones = useSanitarioStore((s) => s.zones);
  const selectedId = useSanitarioStore((s) => s.selectedVictimId);
  const select = useSanitarioStore((s) => s.selectVictim);
  const removeVictim = useSanitarioStore((s) => s.removeVictim);
  const removeZone = useSanitarioStore((s) => s.removeZone);
  const hideOthers = useMapLayerStore(selectHideOtherMarkers);

  return (
    <>
      {!readOnly && <ClickCapture />}

      {!hideOthers && (
        <>
      <LayersControl.Overlay checked name="Hospitales">
        <LayerGroup>
          {hospitals.map((h) => {
            const ratio =
              h.beds.total > 0 ? 1 - h.beds.available / h.beds.total : 0;
            return (
              <Marker
                key={h.id}
                position={[h.location.lat, h.location.lng]}
                icon={createHospitalMarker(h.name, h.level, ratio)}
              >
                <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                  <strong>{h.name}</strong> · Nivel {h.level}
                  <div style={{ fontSize: 10, opacity: 0.8 }}>
                    Camas {h.beds.available}/{h.beds.total} · {Math.round(ratio * 100)}% ocup.
                  </div>
                </Tooltip>
                <Popup>
                  <PopupCard
                    kicker={`HOSPITAL · NIVEL ${h.level}`}
                    title={h.name}
                    rows={[
                      ["Camas libres", `${h.beds.available} / ${h.beds.total}`],
                      ["Ocupación", `${Math.round(ratio * 100)}%`],
                    ]}
                  />
                </Popup>
              </Marker>
            );
          })}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Zonas sanitarias">
        <LayerGroup>
          {zones.map((z) => (
            <Marker
              key={z.id}
              position={[z.location.lat, z.location.lng]}
              icon={createSanitaryZoneMarker(z.label, z.kind)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{z.label}</strong> · {ZONE_KICKER[z.kind] ?? "ZONA"}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {z.state.toUpperCase()} · {z.current}/{z.capacity}
                </div>
              </Tooltip>
              <Popup>
                <PopupCard
                  kicker={ZONE_KICKER[z.kind] ?? "ZONA SANITARIA"}
                  title={z.label}
                  rows={[
                    ["Estado", z.state.toUpperCase()],
                    ["Ocupación", `${z.current} / ${z.capacity}`],
                  ]}
                  onDelete={readOnly ? undefined : () => removeZone(z.id)}
                />
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Víctimas">
        <LayerGroup>
          {victims.map((v) => (
            <Marker
              key={v.id}
              position={[v.location.lat, v.location.lng]}
              icon={createVictimMarker(v.code, v.triage)}
              eventHandlers={
                readOnly
                  ? undefined
                  : { click: () => select(selectedId === v.id ? null : v.id) }
              }
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{v.code}</strong> · {TRIAGE_LABEL[v.triage] ?? v.triage.toUpperCase()}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {v.status.toUpperCase()}
                  {v.injuries ? ` · ${v.injuries}` : ""}
                </div>
              </Tooltip>
              <Popup>
                <PopupCard
                  kicker="VÍCTIMA"
                  title={v.code}
                  rows={[
                    ["Triaje", TRIAGE_LABEL[v.triage] ?? v.triage.toUpperCase()],
                    ["Estado", v.status.toUpperCase()],
                    ...(v.injuries ? ([["Lesiones", v.injuries]] as [string, string][]) : []),
                  ]}
                  onDelete={readOnly ? undefined : () => removeVictim(v.id)}
                />
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Ambulancias">
        <LayerGroup>
          {ambulances.map((a) => (
            <Marker
              key={a.id}
              position={[a.location.lat, a.location.lng]}
              icon={createAmbulanceMarker(a.callSign, a.state)}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <strong>{a.callSign}</strong> · {a.kind.toUpperCase()}
                <div style={{ fontSize: 10, opacity: 0.8 }}>
                  {AMB_STATE[a.state] ?? a.state.toUpperCase()}
                </div>
              </Tooltip>
              <Popup>
                <PopupCard
                  kicker={`AMBULANCIA · ${a.kind.toUpperCase()}`}
                  title={a.callSign}
                  rows={[
                    ["Estado", AMB_STATE[a.state] ?? a.state.toUpperCase()],
                  ]}
                />
              </Popup>
            </Marker>
          ))}
        </LayerGroup>
      </LayersControl.Overlay>

      <LayersControl.Overlay checked name="Rutas evacuación">
        <LayerGroup>
          {victims
            .filter((v) => v.assignedAmbulanceId && v.assignedHospitalId)
            .map((v) => {
              const amb = ambulances.find((a) => a.id === v.assignedAmbulanceId);
              const hsp = hospitals.find((h) => h.id === v.assignedHospitalId);
              if (!amb || !hsp) return null;
              return (
                <Polyline
                  key={`route-${v.id}`}
                  positions={[
                    [amb.location.lat, amb.location.lng],
                    [hsp.location.lat, hsp.location.lng],
                  ]}
                  pathOptions={{
                    color: tacticalColors.state.active,
                    weight: 3,
                    opacity: 0.85,
                    dashArray: "8 6",
                  }}
                />
              );
            })}
        </LayerGroup>
      </LayersControl.Overlay>
        </>
      )}
    </>
  );
};
