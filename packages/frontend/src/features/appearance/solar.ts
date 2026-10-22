import { getTimes } from 'suncalc';
import type { Point } from '../map/types';

export type Appearance = 'light' | 'dark';

// All dates are absolute instants. The device timezone does not determine daylight.
export function solarAppearance(now: Date, point: Point | null, fallback: Appearance): Appearance {
  if (!point) return fallback;
  const times = getTimes(now, point.lat, point.lng);
  if (times.alwaysUp) return 'light';
  if (times.alwaysDown) return 'dark';
  if (!times.sunrise || !times.sunset) return fallback;
  return now >= times.sunrise && now < times.sunset ? 'light' : 'dark';
}
