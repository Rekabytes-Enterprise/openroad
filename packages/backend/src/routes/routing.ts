export type Point = Readonly<{ lat: number; lng: number }>;
export type RouteInput = { origin: Point; destination: Point };
export type DrivingRoute = { points: Point[]; distanceMeters: number; durationSeconds: number };
export class RouteError extends Error {
  constructor(public readonly status: 400 | 404 | 502 | 503 | 504, message: string) { super(message); }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function number(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function point(value: unknown): value is Point {
  return record(value) && number(value.lat) && Math.abs(value.lat) <= 90 && number(value.lng) && Math.abs(value.lng) <= 180;
}
export function parseInput(value: unknown): RouteInput {
  if (!record(value) || !point(value.origin) || !point(value.destination)) throw new RouteError(400, 'Provide valid origin and destination coordinates.');
  if (value.origin.lat === value.destination.lat && value.origin.lng === value.destination.lng) throw new RouteError(400, 'Choose a different destination.');
  return { origin: value.origin, destination: value.destination };
}
export function parseRoute(value: unknown): DrivingRoute {
  if (record(value) && ['NoRoute', 'NoSegment'].includes(String(value.code))) throw new RouteError(404, 'No driving route was found between these points.');
  if (!record(value) || value.code !== 'Ok' || !Array.isArray(value.routes)) throw new RouteError(502, 'Routing provider returned an invalid response.');
  const route: unknown = value.routes[0];
  if (!record(route) || !number(route.distance) || route.distance < 0 || !number(route.duration) || route.duration < 0 || !record(route.geometry) || route.geometry.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) throw new RouteError(502, 'Routing provider returned an invalid route.');
  const points = route.geometry.coordinates.map((coordinate: unknown): Point => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) throw new RouteError(502, 'Invalid route geometry.');
    const candidate: unknown = { lng: coordinate[0], lat: coordinate[1] };
    if (!point(candidate)) throw new RouteError(502, 'Invalid route geometry.');
    return candidate;
  });
  return { points, distanceMeters: route.distance, durationSeconds: route.duration };
}
export async function drivingRoute(input: RouteInput, transport: typeof fetch = fetch): Promise<DrivingRoute> {
  const base = new URL(process.env.OSRM_URL ?? 'https://router.project-osrm.org');
  if (!['http:', 'https:'].includes(base.protocol)) throw new RouteError(503, 'Routing provider is not configured.');
  const coordinates = [input.origin, input.destination].map(p => `${p.lng},${p.lat}`).join(';');
  const url = new URL(`/route/v1/driving/${coordinates}`, base);
  url.search = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'false', radiuses: '1000;1000' }).toString();
  try {
    const response = await transport(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'OpenRoad/0.1 local-preview' } });
    const payload: unknown = await response.json();
    if (response.status === 429) throw new RouteError(503, 'Routing is busy. Please try again shortly.');
    if (!response.ok && !(record(payload) && ['NoRoute', 'NoSegment'].includes(String(payload.code)))) throw new RouteError(502, 'Routing provider is unavailable.');
    return parseRoute(payload);
  } catch (error) {
    if (error instanceof RouteError) throw error;
    if (error instanceof Error && error.name === 'TimeoutError') throw new RouteError(504, 'Route calculation timed out. Please try again.');
    throw new RouteError(502, 'Routing provider could not be reached.');
  }
}
