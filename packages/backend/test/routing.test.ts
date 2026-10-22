import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { drivingRoute, parseInput, parseRoute, RouteError } from '../src/routes/routing.js';
const origin = { lat: 3.1486, lng: 101.6935 };
const destination = { lat: 3.155, lng: 101.713 };
const body = { origin, destination };
const route = { points: [origin, destination], distanceMeters: 4000, durationSeconds: 600 };
function request(app: ReturnType<typeof createApp>, payload: unknown = body) {
  return app.request('/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
test('rejects bad coordinates and identical endpoints', () => {
  for (const input of [null, {}, { origin: { lat: 91, lng: 0 }, destination }, { origin: { lat: NaN, lng: 0 }, destination }, { origin, destination: origin }]) assert.throws(() => parseInput(input), RouteError);
});
test('valid routes are no-store and repeated requests are throttled', async () => {
  let calls = 0;
  const app = createApp(async input => { calls++; assert.deepEqual(input, body); return route; });
  const response = await request(app);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), route);
  assert.equal((await request(app)).status, 429);
  assert.equal(calls, 1);
});
test('invalid input never reaches provider; body limit is enforced', async () => {
  let called = false;
  const app = createApp(async () => { called = true; return route; });
  assert.equal((await request(app, {})).status, 400);
  assert.equal((await request(app, { padding: 'a'.repeat(3000) })).status, 413);
  assert.equal(called, false);
});
test('no route is distinct from provider failure', async () => {
  const app = createApp(async () => { throw new RouteError(404, 'No driving route'); });
  assert.equal((await request(app)).status, 404);
  assert.throws(() => parseRoute({ code: 'NoRoute' }), error => error instanceof RouteError && error.status === 404);
  for (const bad of [{}, { code: 'Ok', routes: [] }, { code: 'Ok', routes: [{ distance: 1, duration: 1, geometry: { type: 'LineString', coordinates: [[999, 0], [1, 2]] } }] }]) assert.throws(() => parseRoute(bad), RouteError);
});
test('adapter preserves longitude-latitude order and normalizes route geometry', async () => {
  const result = await drivingRoute(body, async input => {
    const url = String(input);
    assert.match(url, /101.6935,3.1486;101.713,3.155/);
    assert.match(url, /geometries=geojson/);
    return Response.json({ code: 'Ok', routes: [{ distance: 4000, duration: 600, geometry: { type: 'LineString', coordinates: [[101.6935, 3.1486], [101.713, 3.155]] } }] });
  });
  assert.deepEqual(result, route);
});
test('timeout and upstream errors are sanitized', async () => {
  await assert.rejects(drivingRoute(body, async () => { throw new DOMException('Sensitive URL', 'TimeoutError'); }), error => error instanceof RouteError && error.status === 504 && !error.message.includes('Sensitive'));
  await assert.rejects(drivingRoute(body, async () => new Response('broken', { status: 500 })), error => error instanceof RouteError && error.status === 502);
});
test('requests and validates turn maneuvers from OSRM', async () => {
  const payload = { code: 'Ok', routes: [{ distance: 4000, duration: 600, geometry: { type: 'LineString', coordinates: [[101.6935,3.1486],[101.713,3.155]] }, legs: [{ steps: [{ name: 'Jalan Ampang', distance: 200, duration: 20, maneuver: { type: 'turn', modifier: 'left', location: [101.6935,3.1486], bearing_after: 90 } }] }] }] };
  const result = await drivingRoute(body, async input => { assert.match(String(input), /steps=true/); return Response.json(payload); });
  assert.equal(result.steps?.[0].modifier, 'left');
  assert.deepEqual(result.steps?.[0].point, origin);
  payload.routes[0].legs[0].steps[0].maneuver.bearing_after = NaN;
  assert.throws(() => parseRoute(payload), RouteError);
});
test('lane normalization preserves order and uses only the maneuver intersection', async () => {
  const { parseLanes } = await import('../src/routes/routing.js');
  const lanes = [{ indications: ['left'], valid: true }, { indications: ['left', 'straight'], valid: true }, { indications: ['straight'], valid: false }];
  assert.deepEqual(parseLanes([{ lanes }]), lanes);
  assert.equal(parseLanes([{}, { lanes }]), undefined);
  assert.equal(parseLanes([{ lanes: [{ indications: ['left'], valid: 'true' }] }]), undefined);
  assert.equal(parseLanes([{ lanes: [] }]), undefined);
});
