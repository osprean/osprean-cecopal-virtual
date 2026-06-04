import type { GeoPoint } from "../types";

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  cycleway?: string;
  footway?: string;
  highway?: string;
  street?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  state?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

export interface ReverseGeocodeResult {
  road: string | null;
  km: string | null;
  locality: string | null;
  raw?: NominatimResponse;
}

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

// Reverse-geocode a point against OSM Nominatim. Public endpoint, no auth.
// Use sparingly (max ~1 req/sec) — fine for one-off operator clicks.
export const reverseGeocode = async (
  point: GeoPoint,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> => {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: "17",
    addressdetails: "1",
    "accept-language": "es",
  });

  const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = (await res.json()) as NominatimResponse;
  const a = data.address ?? {};

  const road =
    a.road ||
    a.pedestrian ||
    a.cycleway ||
    a.footway ||
    a.street ||
    a.highway ||
    null;

  const locality =
    a.village || a.town || a.city || a.suburb || a.neighbourhood || a.state || null;

  return { road, km: null, locality, raw: data };
};

const NOMINATIM_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";

// GeoJSON coordinate: [lng, lat]
export type LngLat = [number, number];

export type GeocodeGeometry =
  | { type: "Point"; coordinates: LngLat }
  | { type: "LineString"; coordinates: LngLat[] }
  | { type: "MultiLineString"; coordinates: LngLat[][] }
  | { type: "Polygon"; coordinates: LngLat[][] }
  | { type: "MultiPolygon"; coordinates: LngLat[][][] };

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  // boundingBox = [south, north, west, east] (Nominatim format).
  // Útil como fallback cuando no hay geometría detallada.
  boundingBox?: [number, number, number, number];
  // Geometría real OSM en GeoJSON. Para calles suele ser LineString o
  // MultiLineString; para barrios/zonas, Polygon/MultiPolygon.
  geometry?: GeocodeGeometry;
  displayName: string;
  osmType?: string;
  osmId?: number;
  category?: string;
  type?: string;
}

interface NominatimSearchItem {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  geojson?: GeocodeGeometry;
}

// Forward geocode. Para una calle, p.ej. "Calle Mayor, Madrid", devuelve un
// punto y bbox. Si la consulta no incluye ciudad, añadimos "Madrid, España"
// como contexto por defecto del demo.
export const forwardGeocode = async (
  query: string,
  signal?: AbortSignal,
): Promise<ForwardGeocodeResult | null> => {
  const hasContext = /,|madrid|barcelona|valencia|sevilla|españa|spain/i.test(query);
  const q = hasContext ? query : `${query}, Madrid, España`;

  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    limit: "1",
    addressdetails: "0",
    polygon_geojson: "1", // <-- devuelve la geometría real (LineString/Polygon)
    "accept-language": "es",
  });

  const res = await fetch(`${NOMINATIM_SEARCH_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim search ${res.status}`);
  const arr = (await res.json()) as NominatimSearchItem[];
  if (!arr.length) return null;
  const r = arr[0];
  const bbox = r.boundingbox
    ? ([Number(r.boundingbox[0]), Number(r.boundingbox[1]), Number(r.boundingbox[2]), Number(r.boundingbox[3])] as [number, number, number, number])
    : undefined;
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    boundingBox: bbox,
    geometry: r.geojson,
    displayName: r.display_name,
    osmType: r.osm_type,
    osmId: r.osm_id,
    category: r.category,
    type: r.type,
  };
};
