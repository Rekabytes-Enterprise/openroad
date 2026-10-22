import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { parseSearch, parsePlaces, searchPlaces, SearchError } from '../src/routes/search.js';
const feature = { type: 'Feature', properties: { name: 'KLCC', osm_type: 'N', osm_id: 123, city: 'Kuala Lumpur', country: 'Malaysia' }, geometry: { type: 'Point', coordinates: [101.71, 3.15] } };
test('search rejects short or oversized queries', () => {
  for (const query of ['', ' a ', 'x'.repeat(161), null]) assert.throws(() => parseSearch({ query }), SearchError);
  assert.equal(parseSearch({ query: '  KLCC  ' }), 'KLCC');
});
test('Photon normalization validates coordinates, deduplicates IDs, preserves lat/lng', () => {
  const places = parsePlaces({ type: 'FeatureCollection', features: [feature, feature, { ...feature, geometry: { type: 'Point', coordinates: [999, 3] } }] });
  assert.equal(places.length, 1);
  assert.deepEqual(places[0]?.point, { lat: 3.15, lng: 101.71 });
  assert.equal(places[0]?.id, 'osm:N:123');
  assert.throws(() => parsePlaces({ error: 'bad' }), SearchError);
  assert.deepEqual(parsePlaces({ type: 'FeatureCollection', features: [] }), []);
});
test('search endpoint validates input and body size before calling provider', async () => {
  const calls: string[] = [];
  const app = createApp(undefined, async query => { calls.push(query); return parsePlaces({ type: 'FeatureCollection', features: [feature] }); });
  const request = (body: string) => app.request('/places/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.equal((await request('{')).status, 400);
  assert.equal((await request(JSON.stringify({ query: 'ab' }))).status, 400);
  assert.equal((await request('x'.repeat(3000))).status, 413);
  assert.deepEqual(calls, []);
  const result = await request(JSON.stringify({ query: 'KLCC' }));
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, ['KLCC']);
});
test('adapter encodes query, limits results, and sanitizes provider errors', async () => {
  const previous = process.env.PHOTON_URL;
  process.env.PHOTON_URL = 'https://po-openroad.techapi.my';
  try {
    const places = await searchPlaces('KLCC & park', async input => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('q'), 'KLCC & park');
      assert.equal(url.searchParams.get('limit'), '8');
      return Response.json({ type: 'FeatureCollection', features: [feature] });
    });
    assert.equal(places.length, 1);
    await assert.rejects(searchPlaces('KLCC', async () => new Response('<html>proxy</html>')), error => error instanceof SearchError && error.status === 502);
    await assert.rejects(searchPlaces('KLCC', async () => { throw new DOMException('secret', 'TimeoutError'); }), error => error instanceof SearchError && error.status === 504 && !error.message.includes('secret'));
  } finally { if (previous === undefined) delete process.env.PHOTON_URL; else process.env.PHOTON_URL = previous; }
});
