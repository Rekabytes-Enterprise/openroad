import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
const origin = { lat: 3.1486, lng: 101.6935 };
const destination = { lat: 3.155, lng: 101.713 };
const route = { points: [origin, destination], distanceMeters: 4000, durationSeconds: 600 };
const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
for (const prefix of ['', '/api/v1']) test(`${prefix || 'legacy'} endpoints preserve validation and response contracts`, async () => {
  const app = createApp(async () => route, async input => {
    assert.equal(input.query, 'KLCC');
    return [{ id: 'osm:N:1', name: 'KLCC', detail: 'Kuala Lumpur', point: destination }];
  });
  assert.deepEqual(await (await app.request(`${prefix}/health`)).json(), { status: 'ok', service: 'openroad-backend' });
  for (const path of ['/routes', '/places/search']) {
    assert.equal((await post(app, prefix + path, {})).status, 400);
    assert.equal((await post(app, prefix + path, { padding: 'x'.repeat(3000) })).status, 413);
  }
  const search = await post(app, `${prefix}/places/search`, { query: 'KLCC' });
  assert.equal(search.status, 200);
  assert.equal(search.headers.get('cache-control'), 'no-store');
  const response = await post(app, `${prefix}/routes`, { origin, destination });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), route);
  assert.equal((await app.request('/api/v2/health')).status, 404);
});
test('legacy and v1 route aliases share the throttle', async () => {
  const app = createApp(async () => route);
  assert.equal((await post(app, '/api/v1/routes', { origin, destination })).status, 200);
  const response = await post(app, '/routes', { origin, destination });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '1');
});
