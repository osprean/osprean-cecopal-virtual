import L from "leaflet";
import "leaflet/dist/leaflet.css";

const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// CARTO Positron — light, neutral basemap aligned with COMACON light surfaces.
export const TACTICAL_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

export const TACTICAL_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/">OSM</a> · &copy; <a href="https://carto.com/">CARTO</a>';

// Capas base disponibles en el control de capas. Las URLs son tile-servers
// públicos y gratuitos; no requieren API key. Cada capa indica si soporta
// fondo transparente o requiere un tono concreto.
export interface BaseLayerDef {
  key: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string | string[];
}

export const BASE_LAYERS: BaseLayerDef[] = [
  {
    key: "carto-light",
    name: "Calles (claro)",
    url: TACTICAL_TILE_URL,
    attribution: TACTICAL_TILE_ATTRIBUTION,
    maxZoom: 19,
    subdomains: "abcd",
  },
  {
    key: "carto-dark",
    name: "Calles (oscuro)",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: TACTICAL_TILE_ATTRIBUTION,
    maxZoom: 19,
    subdomains: "abcd",
  },
  {
    key: "osm",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
    subdomains: "abc",
  },
  {
    key: "esri-sat",
    name: "Satélite",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
  },
  {
    key: "opentopo",
    name: "Topográfico",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
    subdomains: "abc",
  },
  {
    key: "esri-streets",
    name: "Esri Calles",
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
];

// Centered on the active emergency (El Álamo, Madrid) by default.
export const DEFAULT_CENTER: [number, number] = [40.2295, -4.0156];
export const DEFAULT_ZOOM = 14;
