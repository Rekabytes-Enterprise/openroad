export type Place = { id: string; name: string; detail: string; point: { lat: number; lng: number } };
export type SearchInput = { query: string; proximity: Place["point"] | null };
export class SearchError extends Error {
  constructor(public readonly status: 400 | 502 | 503 | 504, message: string) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parseSearch(value: unknown): SearchInput {
  if (!record(value) || typeof value.query !== 'string') throw new SearchError(400, 'Enter a place name.');
  const query = value.query.trim();
  if (query.length < 3 || query.length > 160) throw new SearchError(400, 'Enter between 3 and 160 characters.');
  let proximity: Place['point'] | null = null;
  if (value.proximity !== undefined && value.proximity !== null) {
    const p = value.proximity;
    if (!record(p) || typeof p.lat !== 'number' || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || typeof p.lng !== 'number' || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180) throw new SearchError(400, 'Invalid search location.');
    proximity = { lat: p.lat, lng: p.lng };
  }
  return { query, proximity };
}
export function parsePlaces(value: unknown, limit = 8): Place[] {
  if (!record(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) throw new SearchError(502, 'Search returned an invalid response.');
  const places = new Map<string, Place>();
  for (const feature of value.features) {
    if (!record(feature) || !record(feature.properties) || !record(feature.geometry) || feature.geometry.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) continue;
    const p = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 || typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180) continue;
    if (typeof p.name !== 'string' || !p.name.trim() || typeof p.osm_type !== 'string' || typeof p.osm_id !== 'number' || !Number.isSafeInteger(p.osm_id)) continue;
    const id = `osm:${p.osm_type}:${p.osm_id}`;
    const detail = [...new Set([p.street, p.city, p.state, p.country].filter((part): part is string => typeof part === 'string' && part.length > 0))].join(', ');
    places.set(id, { id, name: p.name, detail, point: { lat, lng } });
    if (places.size === limit) break;
  }
  return [...places.values()];
}
export async function searchPlaces(input: SearchInput, transport: typeof fetch = fetch): Promise<Place[]> {
  try {
    const configured = process.env.PHOTON_URL;
    if (!configured) throw new SearchError(503, 'Place search is not configured.');
    const base = new URL(configured);
    if (!['http:', 'https:'].includes(base.protocol)) throw new SearchError(503, 'Place search is not configured.');
    const signal = AbortSignal.timeout(8000);
    async function request(bbox?: string) {
      const url = new URL('/api', base);
      url.search = new URLSearchParams({ q: input.query, limit: bbox ? '32' : '8', lang: 'en' }).toString();
      if (input.proximity) {
        url.searchParams.set('lat', String(input.proximity.lat));
        url.searchParams.set('lon', String(input.proximity.lng));
      }
      if (bbox) url.searchParams.set('bbox', bbox);
      const response = await transport(url, { cache: 'no-store', signal });
      if (!response.ok) throw new SearchError(502, 'Place search is unavailable. Try again.');
      const value: unknown = await response.json();
      return parsePlaces(value, bbox ? 32 : 8);
    }
    if (!input.proximity) return await request();
    const center = input.proximity;
    const latDelta = 5 / 6371 * 180 / Math.PI;
    const lngDelta = Math.abs(center.lat) + latDelta >= 90 ? 180 : Math.asin(Math.sin(5 / 6371) / Math.cos(center.lat * Math.PI / 180)) * 180 / Math.PI;
    // A dateline-crossing circle needs two boxes; merge and deduplicate their results.
    const south = Math.max(-90, center.lat - latDelta), north = Math.min(90, center.lat + latDelta);
    const west = center.lng - lngDelta, east = center.lng + lngDelta;
    const boxes = lngDelta === 180 ? [[-180, 180]] : west < -180 ? [[west + 360, 180], [-180, east]] : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
    const nearby = (await Promise.all(boxes.map(([w, e]) => request(`${w},${south},${e},${north}`)))).flat()
      .filter(place => distanceKm(center, place.point) <= 5)
      .sort((a, b) => distanceKm(center, a.point) - distanceKm(center, b.point));
    const unique = new Map(nearby.map(place => [place.id, place]));
    if (unique.size < 8) for (const place of await request()) if (!unique.has(place.id)) unique.set(place.id, place);
    return [...unique.values()].sort((a, b) => {
      const da = distanceKm(center, a.point), db = distanceKm(center, b.point);
      return da <= 5 && db <= 5 ? da - db : da <= 5 ? -1 : db <= 5 ? 1 : 0;
    }).slice(0, 8);
  } catch (error) {
    if (error instanceof SearchError) throw error;
    if (error instanceof Error && error.name === 'TimeoutError') throw new SearchError(504, 'Place search timed out. Try again.');
    throw new SearchError(502, 'Place search is unavailable. Try again.');
  }
}

export function distanceKm(a: Place['point'], b: Place['point']): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
