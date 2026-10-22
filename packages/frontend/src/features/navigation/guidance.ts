import type { Point } from '../map/types';
import type { DrivingRoute, RouteStep } from '../routing/route';

const radians = Math.PI / 180;
export function distance(a: Point, b: Point): number {
  const y = (b.lat - a.lat) * radians;
  const x = (b.lng - a.lng) * radians;
  const h = Math.sin(y / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(x / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function bearing(a: Point, b: Point): number {
  const delta = (b.lng - a.lng) * radians;
  return (Math.atan2(Math.sin(delta) * Math.cos(b.lat * radians), Math.cos(a.lat * radians) * Math.sin(b.lat * radians) - Math.sin(a.lat * radians) * Math.cos(b.lat * radians) * Math.cos(delta)) / radians + 360) % 360;
}
/** Project on road segments, not vertices, so sparse geometry still gives useful progress. */
export function progress(route: DrivingRoute, point: Point) {
  let total = 0;
  let best = { offset: 0, away: Infinity, heading: 0, segmentEnd: 1, projected: route.points[0] };
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1];
    const b = route.points[i];
    const scale = Math.cos(point.lat * radians);
    const x = (b.lng - a.lng) * scale;
    const y = b.lat - a.lat;
    const fraction = Math.max(0, Math.min(1, ((point.lng - a.lng) * scale * x + (point.lat - a.lat) * y) / (x * x + y * y || 1)));
    const projected = { lat: a.lat + fraction * y, lng: a.lng + fraction * (b.lng - a.lng) };
    const length = distance(a, b);
    const away = distance(point, projected);
    if (away < best.away) best = { offset: total + fraction * length, away, heading: bearing(a, b), segmentEnd: i, projected };
    total += length;
  }
  const remaining = Math.max(0, total - best.offset);
  let offset = 0;
  let next: RouteStep | undefined;
  let toTurn = remaining;
  // OSRM step distances and overview length have slightly different rounding.
  const routeOffset = total > 0 ? best.offset / total * route.distanceMeters : 0;
  for (const step of route.steps ?? []) {
    if (step.type !== 'depart' && offset >= routeOffset - 5) { next = step; toTurn = Math.max(0, offset - routeOffset); break; }
    offset += step.distanceMeters;
  }
  return { ...best, remainingPoints: remaining < 1 ? [] : [best.projected, ...route.points.slice(best.segmentEnd)], remaining, next, toTurn, seconds: total ? route.durationSeconds * remaining / total : 0,
    arrived: remaining < 25 && distance(point, route.points[route.points.length - 1]) < 30 };
}
export function instruction(step: RouteStep | undefined): string {
  if (!step) return 'Follow the route';
  if (step.type === 'arrive') return 'Arrive at your destination';
  if (step.type.includes('roundabout') || step.type === 'rotary') return step.exit ? `At the roundabout, take exit ${step.exit}` : 'Enter the roundabout';
  if (step.modifier === 'uturn') return 'Make a U-turn';
  const direction = step.modifier.replace('slight ', 'slightly ').replace('sharp ', 'sharply ');
  const action = step.type === 'merge' ? 'Merge' : step.type === 'off ramp' ? 'Take the exit' : step.type === 'fork' ? 'Keep' : step.modifier && step.modifier !== 'straight' ? 'Turn' : 'Continue';
  return `${action}${direction && direction !== 'straight' ? ` ${direction}` : ' straight'}${step.name ? ` onto ${step.name}` : ''}`;
}
export function turnAngle(step: RouteStep | undefined): number {
  switch (step?.modifier) {
    case 'uturn': return 180;
    case 'sharp left': return -135;
    case 'left': return -90;
    case 'slight left': return -45;
    case 'slight right': return 45;
    case 'right': return 90;
    case 'sharp right': return 135;
    default: return 0;
  }
}
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.max(0, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Device speed is metres per second; unavailable is not stationary. */
export function speedKmh(speed: number | null | undefined, reliable: boolean): number | null {
  return reliable && typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? Math.round(speed * 3.6) : null;
}
