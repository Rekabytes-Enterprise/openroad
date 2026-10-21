import { expect, it } from 'vitest';
import { parseRoute } from '../src/features/routing/route';
it('accepts valid route points and rejects malformed provider data at the boundary', () => {
  const route = { points: [{ lat: 3, lng: 101 }, { lat: 3.1, lng: 101.1 }], distanceMeters: 20, durationSeconds: 10 };
  expect(parseRoute(route)).toEqual(route);
  for (const bad of [null, {}, { ...route, points: [] }, { ...route, durationSeconds: Infinity }, { ...route, points: [{ lat: 999, lng: 101 }, { lat: 3, lng: 101 }] }]) expect(() => parseRoute(bad)).toThrow();
});
