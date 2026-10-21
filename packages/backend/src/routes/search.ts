export type Place = { id: string; name: string; detail: string; point: { lat: number; lng: number } };
export class SearchError extends Error {
  constructor(public readonly status: 400 | 502 | 503 | 504, message: string) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function parseSearch(value: unknown): string {
  if (!record(value) || typeof value.query !== 'string') throw new SearchError(400, 'Enter a place name.');
  const query = value.query.trim();
  if (query.length < 3 || query.length > 160) throw new SearchError(400, 'Enter between 3 and 160 characters.');
  return query;
}
export function parsePlaces(value: unknown): Place[] {
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
    if (places.size === 8) break;
  }
  return [...places.values()];
}
export async function searchPlaces(query: string, transport: typeof fetch = fetch): Promise<Place[]> {
  try {
    const configured = process.env.PHOTON_URL;
    if (!configured) throw new SearchError(503, 'Place search is not configured.');
    const base = new URL(configured);
    if (!['http:', 'https:'].includes(base.protocol)) throw new SearchError(503, 'Place search is not configured.');
    const url = new URL('/api', base);
    url.search = new URLSearchParams({ q: query, limit: '8', lang: 'en' }).toString();
    const response = await transport(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new SearchError(502, 'Place search is unavailable. Try again.');
    const value: unknown = await response.json();
    return parsePlaces(value);
  } catch (error) {
    if (error instanceof SearchError) throw error;
    if (error instanceof Error && error.name === 'TimeoutError') throw new SearchError(504, 'Place search timed out. Try again.');
    throw new SearchError(502, 'Place search is unavailable. Try again.');
  }
}
