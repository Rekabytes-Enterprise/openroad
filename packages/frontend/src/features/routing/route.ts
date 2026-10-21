import { validPoint, type Point } from '../map/types';
export type DrivingRoute = { points: Point[]; distanceMeters: number; durationSeconds: number };
export type RouteState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; route: DrivingRoute } | { kind: 'error'; message: string };
export function parseRoute(value: unknown): DrivingRoute {
  if (!value || typeof value !== 'object' || !('points' in value) || !Array.isArray(value.points) || value.points.length < 2 || !value.points.every(validPoint)
    || !('distanceMeters' in value) || typeof value.distanceMeters !== 'number' || !Number.isFinite(value.distanceMeters) || value.distanceMeters < 0
    || !('durationSeconds' in value) || typeof value.durationSeconds !== 'number' || !Number.isFinite(value.durationSeconds) || value.durationSeconds < 0) throw new Error('The route response is invalid. Please try again.');
  return { points: value.points, distanceMeters: value.distanceMeters, durationSeconds: value.durationSeconds };
}
