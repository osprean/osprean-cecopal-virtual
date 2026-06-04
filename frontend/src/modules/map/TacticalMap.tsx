import { useEffect, useRef, type ReactNode } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  LayersControl,
  LayerGroup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  BASE_LAYERS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
} from "./leafletConfig";
import { createResourceMarker, createTacticalMarker } from "./markers";
import {
  selectHideOtherMarkers,
  useEmergencyStore,
  useMapFlyStore,
  useMapLayerStore,
  useMapViewStore,
  useResourcesStore,
} from "../../store";
import { tacticalColors } from "../../theme/colors";

interface TacticalMapProps {
  children?: ReactNode;
  center?: [number, number];
  zoom?: number;
}

// Escucha el evento baselayerchange del LayersControl y actualiza el store
// global. Así, cuando el usuario cambia de capa en una página, todas las
// demás recuerdan la elección al volver a montarse.
const BaseLayerSync = () => {
  const setLayerKey = useMapLayerStore((s) => s.setLayerKey);
  useMapEvents({
    baselayerchange: (e) => {
      const match = BASE_LAYERS.find((l) => l.name === e.name);
      if (match) setLayerKey(match.key);
    },
  });
  return null;
};

// Escucha el store de "vuelo del mapa" y aplica flyTo / flyToBounds sobre el
// mapa actual cada vez que cambia el nonce. Lo usa el Centro IA para encuadrar
// la zona donde está a punto de dibujar.
// Marker "tú estás aquí" — círculo pulsante teal sobre la ubicación del
// operador. Siempre visible en cualquier pestaña que renderice TacticalMap.
const USER_LOCATION_ICON = L.divIcon({
  className: "ops-user-location",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `
    <div style="
      position: relative;
      width: 22px;
      height: 22px;
    ">
      <div style="
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(49,151,149,0.25);
        animation: ops-user-pulse 1.6s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 5px; left: 5px;
        width: 12px; height: 12px;
        border-radius: 50%;
        background: #319795;
        box-shadow: 0 0 0 2px #ffffff, 0 1px 4px rgba(15,22,36,0.3);
      "></div>
    </div>
    <style>
      @keyframes ops-user-pulse {
        0% { transform: scale(0.7); opacity: 0.9; }
        100% { transform: scale(2.4); opacity: 0; }
      }
    </style>
  `,
});

const UserLocationMarker = () => {
  const loc = useMapViewStore((s) => s.userLocation);
  if (!loc) return null;
  return (
    <Marker position={[loc.lat, loc.lng]} icon={USER_LOCATION_ICON} interactive={false}>
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        Tu ubicación
      </Tooltip>
    </Marker>
  );
};

// Mantiene sincronizado el center+zoom del mapa con el store global. Al
// montar el mapa: lee la última vista guardada y mueve la cámara allí (sin
// animación, porque es continuidad — no es un vuelo nuevo). Al moverse el
// mapa, guarda el nuevo center+zoom para el próximo montaje.
const MapViewSync = () => {
  const map = useMap();
  const savedView = useMapViewStore.getState().view;
  const userLocation = useMapViewStore.getState().userLocation;
  const setView = useMapViewStore((s) => s.setView);
  const restoredRef = useRef(false);

  // Restaura la vista una vez por montaje.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (savedView) {
      map.setView([savedView.center.lat, savedView.center.lng], savedView.zoom, {
        animate: false,
      });
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], DEFAULT_ZOOM, {
        animate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      setView({ lat: c.lat, lng: c.lng }, map.getZoom());
    },
  });
  return null;
};

const MapFlyController = () => {
  const map = useMap();
  const request = useMapFlyStore((s) => s.request);
  const nonce = useMapFlyStore((s) => s.nonce);
  // Snapshot del nonce al montar. Sólo volamos cuando el nonce CAMBIA después
  // de montar — así, al cambiar de pestaña y montar de nuevo el mapa, no se
  // re-dispara el último vuelo pendiente.
  const baselineNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (baselineNonceRef.current === null) {
      baselineNonceRef.current = nonce;
      return;
    }
    if (nonce === baselineNonceRef.current) return;
    if (!request) return;
    if (request.bounds && request.bounds.length >= 1) {
      const bounds = L.latLngBounds(request.bounds.map((p) => [p.lat, p.lng]));
      map.flyToBounds(bounds, {
        padding: [60, 60],
        duration: request.durationSec ?? 1.4,
        maxZoom: 18,
      });
      return;
    }
    if (request.point) {
      map.flyTo([request.point.lat, request.point.lng], request.zoom ?? 17, {
        duration: request.durationSec ?? 1.2,
      });
    }
    // Dependencia explícita en nonce para forzar re-ejecución con destino idéntico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
  return null;
};

export const TacticalMap = ({
  children,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
}: TacticalMapProps) => {
  const emergencies = useEmergencyStore((s) => s.emergencies);
  const resources = useResourcesStore((s) => s.resources);
  const selectedLayerKey = useMapLayerStore((s) => s.layerKey);
  const hideOthers = useMapLayerStore(selectHideOtherMarkers);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "#EEF2F6",
      }}
    >
      <BaseLayerSync />
      <MapViewSync />
      <MapFlyController />
      <UserLocationMarker />

      <LayersControl position="topright">
        {BASE_LAYERS.map((layer) => (
          <LayersControl.BaseLayer
            key={layer.key}
            name={layer.name}
            checked={layer.key === selectedLayerKey}
          >
            <TileLayer
              url={layer.url}
              attribution={layer.attribution}
              {...(layer.maxZoom !== undefined ? { maxZoom: layer.maxZoom } : {})}
              {...(layer.subdomains !== undefined ? { subdomains: layer.subdomains } : {})}
            />
          </LayersControl.BaseLayer>
        ))}

        {!hideOthers && (
          <LayersControl.Overlay checked name="Emergencias">
          <LayerGroup>
            {emergencies.map((emg) => (
              <Marker
                key={emg.id}
                position={[emg.location.lat, emg.location.lng]}
                icon={createTacticalMarker(emg.severity, emg.domain)}
              >
                <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                  <strong>{emg.name}</strong> · {emg.code}
                  <div style={{ fontSize: 10, opacity: 0.8 }}>
                    {emg.domain.toUpperCase()} · {emg.severity.toUpperCase()}
                  </div>
                </Tooltip>
              </Marker>
            ))}
            {emergencies
              .filter((e) => e.area && e.area.length > 0)
              .map((emg) => (
                <Polygon
                  key={`${emg.id}-area`}
                  positions={(emg.area ?? []).map((p) => [p.lat, p.lng])}
                  pathOptions={{
                    color:
                      tacticalColors.domain[
                        emg.domain as keyof typeof tacticalColors.domain
                      ] ?? tacticalColors.accent.teal,
                    weight: 1.5,
                    fillOpacity: 0.15,
                    dashArray: "4 4",
                  }}
                />
              ))}
          </LayerGroup>
        </LayersControl.Overlay>
        )}

        {!hideOthers && (
        <LayersControl.Overlay checked name="Recursos">
          <LayerGroup>
            {resources.map((res) => (
              <Marker
                key={res.id}
                position={[res.location.lat, res.location.lng]}
                icon={createResourceMarker(res.callSign)}
              >
                <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                  <strong>{res.callSign}</strong> · {res.kind.toUpperCase()}
                  <div style={{ fontSize: 10, opacity: 0.8 }}>
                    {res.status.toUpperCase()} · {res.agency}
                  </div>
                </Tooltip>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        )}

        {children}
      </LayersControl>
    </MapContainer>
  );
};
