import { validPoint, type Point } from '../map/types';
export type DrivingRoute = { points: Point[]; distanceMeters: number; durationSeconds: number };
export type RouteState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; route: DrivingRoute } | { kind: 'error'; message: string };
export function parseRoute(value: unknown): DrivingRoute {
  if (!value || typeof value !== 'object' || !('points' in value) || !Array.isArray(value.points) || value.points.length < 2 || !value.points.every(validPoint)
    || !('distanceMeters' in value) || typeof value.distanceMeters !== 'number' || !Number.isFinite(value.distanceMeters) || value.distanceMeters < 0
    || !('durationSeconds' in value) || typeof value.durationSeconds !== 'number' || !Number.isFinite(value.durationSeconds) || value.durationSeconds < 0) throw new Error('The route response is invalid. Please try again.');
  return { points: value.points, distanceMeters: value.distanceMeters, durationSeconds: value.durationSeconds };
}

/** Parse the network boundary without exposing proxy HTML or JSON syntax errors. */
export async function readRouteResponse(response: Response): Promise<DrivingRoute> {
  const unavailable = 'Route service is temporarily unavailable. Please try again.';
  let value: unknown;
  try { value = await response.json(); }
  catch { throw new Error(unavailable); }
  if (!response.ok) {
    if (response.status >= 500) throw new Error(unavailable);
    throw new Error(value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
      ? value.error : 'Could not calculate a route. Please try again.');
  }
  return parseRoute(value);
}
