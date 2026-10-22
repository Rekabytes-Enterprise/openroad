import { validPoint, type Point } from '../map/types';
export type Lane = { indications: string[]; valid: boolean };
export type RouteStep = { lanes?: Lane[]; point: Point; distanceMeters: number; durationSeconds: number; name: string; type: string; modifier: string; bearing: number; exit: number | null };
export type DrivingRoute = { steps?: RouteStep[]; points: Point[]; distanceMeters: number; durationSeconds: number };
export type RouteState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; route: DrivingRoute } | { kind: 'error'; message: string };
export function parseRoute(value: unknown): DrivingRoute {
  if (!value || typeof value !== 'object' || !('points' in value) || !Array.isArray(value.points) || value.points.length < 2 || !value.points.every(validPoint)
    || !('distanceMeters' in value) || typeof value.distanceMeters !== 'number' || !Number.isFinite(value.distanceMeters) || value.distanceMeters < 0
    || !('durationSeconds' in value) || typeof value.durationSeconds !== 'number' || !Number.isFinite(value.durationSeconds) || value.durationSeconds < 0) throw new Error('The route response is invalid. Please try again.');
  const steps = 'steps' in value ? value.steps : undefined;
  if (steps !== undefined && (!Array.isArray(steps) || !steps.every(validStep))) throw new Error('The route instructions are invalid. Please try again.');
  return { ...(steps !== undefined ? { steps } : {}), points: value.points, distanceMeters: value.distanceMeters, durationSeconds: value.durationSeconds };
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

function validStep(value: unknown): value is RouteStep {
  if (!value || typeof value !== 'object') return false;
  return (!('lanes' in value) || value.lanes === undefined || Array.isArray(value.lanes) && value.lanes.length <= 16 && value.lanes.every(validLane))
    && 'point' in value && validPoint(value.point)
    && 'distanceMeters' in value && typeof value.distanceMeters === 'number' && Number.isFinite(value.distanceMeters) && value.distanceMeters >= 0
    && 'durationSeconds' in value && typeof value.durationSeconds === 'number' && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0
    && 'name' in value && typeof value.name === 'string' && 'type' in value && typeof value.type === 'string'
    && 'modifier' in value && typeof value.modifier === 'string'
    && 'bearing' in value && typeof value.bearing === 'number' && Number.isFinite(value.bearing) && value.bearing >= 0 && value.bearing <= 360
    && 'exit' in value && (value.exit === null || typeof value.exit === 'number' && Number.isInteger(value.exit) && value.exit > 0);
}

function validLane(value: unknown): value is Lane {
  return !!value && typeof value === 'object' && 'valid' in value && typeof value.valid === 'boolean'
    && 'indications' in value && Array.isArray(value.indications) && value.indications.length > 0
    && value.indications.every((direction: unknown) => typeof direction === 'string');
}
