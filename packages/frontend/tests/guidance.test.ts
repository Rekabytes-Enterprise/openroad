import { expect, it } from 'vitest';
import { progress, instruction, bearing, turnAngle } from '../src/features/navigation/guidance';
import { parseRoute, type DrivingRoute, type RouteStep } from '../src/features/routing/route';
const step: RouteStep = { point: {lat: 0, lng: 0.01}, name: 'Main Street', type: 'turn', modifier: 'right', bearing: 180, exit: null, distanceMeters: 1112, durationSeconds: 60 };
const route: DrivingRoute = { points: [{lat:0,lng:0},{lat:0,lng:0.01},{lat:-0.01,lng:0.01}], distanceMeters:2224, durationSeconds:120, steps: [{...step, type:'depart', distanceMeters:1112}, step, {...step, type:'arrive', distanceMeters:0}] };
it('projects between road vertices and advances to the next maneuver', () => {
  const before = progress(route, {lat:0,lng:0.005});
  expect(before.remaining).toBeCloseTo(1668, -1);
  expect(before.toTurn).toBeCloseTo(556, -1);
  expect(before.next?.type).toBe('turn');
  expect(before.heading).toBeCloseTo(90);
  const after = progress(route, {lat:-0.005,lng:0.01});
  expect(after.next?.type).toBe('arrive');
  expect(after.seconds).toBeCloseTo(30);
});
it('distinguishes arrival from nearby off-route positions', () => {
  expect(progress(route,{lat:-0.01,lng:0.01}).arrived).toBe(true);
  const off = progress(route,{lat:-0.01,lng:0.02});
  expect(off.away).toBeGreaterThan(1000);
  expect(off.arrived).toBe(false);
});
it('provides direction and roundabout instructions', () => {
  expect(instruction(step)).toBe('Turn right onto Main Street');
  expect(turnAngle(step)).toBe(90);
  expect(instruction({...step,type:'roundabout',exit:3})).toContain('exit 3');
  expect(bearing({lat:0,lng:0},{lat:1,lng:0})).toBe(0);
});
it('validates navigation instructions while accepting legacy previews', () => {
  expect(parseRoute(route).steps).toHaveLength(3);
  expect(() => parseRoute({...route,steps:[{...step,bearing:Infinity}]})).toThrow();
  expect(() => parseRoute({...route,steps:[{...step,exit:-1}]})).toThrow();
});
it('removes travelled geometry up to the projected position and clears at the endpoint', () => {
  const p = progress(route, {lat:0,lng:0.005});
  expect(p.remainingPoints[0].lng).toBeCloseTo(0.005);
  expect(p.remainingPoints).not.toContainEqual(route.points[0]);
  expect(p.remainingPoints.at(-1)).toEqual(route.points.at(-1));
  expect(progress(route, {lat:-0.005,lng:0.01}).remainingPoints).toHaveLength(2);
  expect(progress(route, route.points[2]).remainingPoints).toEqual([]);
});
it('converts native speed without confusing unavailable speed with zero', async () => {
  const { speedKmh } = await import('../src/features/navigation/guidance');
  expect(speedKmh(10,true)).toBe(36);
  expect(speedKmh(0,true)).toBe(0);
  for (const value of [null,undefined,-1,NaN,Infinity]) expect(speedKmh(value,true)).toBeNull();
  expect(speedKmh(10,false)).toBeNull();
});
