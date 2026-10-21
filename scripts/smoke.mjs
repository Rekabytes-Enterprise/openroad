import assert from 'node:assert/strict';
const frontend = process.env.FRONTEND_URL ?? 'http://127.0.0.1:4206';
const backend = process.env.BACKEND_URL ?? 'http://127.0.0.1:4205';
for (const url of [`${backend}/health`, `${frontend}/api/health`]) {
  const response = await fetch(url);
  assert.equal(response.status, 200, url);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'openroad-backend' });
}
const home = await fetch(frontend);
assert.equal(home.status, 200);
assert.match(home.headers.get('permissions-policy'), /geolocation=\(self\)/);
assert.match(await home.text(), /Where to\?/);
const worker = await fetch(`${frontend}/sw.js`);
assert.equal(worker.status, 200);
assert.match(worker.headers.get('cache-control'), /no-cache/);
const source = await worker.text();
const match = source.match(/const ASSETS = (\[[^\n]+\]);/);
assert.ok(match, 'worker precache list exists');
const assets = JSON.parse(match[1]);
for (const asset of assets) {
  assert.ok(asset.startsWith('/') && !asset.startsWith('/api/'));
  const response = await fetch(new URL(asset, frontend));
  assert.equal(response.status, 200, `Missing precache asset ${asset}`);
}
const manifest = await (await fetch(`${frontend}/manifest.webmanifest`)).json();
for (const icon of manifest.icons) assert.equal((await fetch(new URL(icon.src,frontend))).status,200);
console.log(`PASS backend, runtime proxy, frontend, geolocation header, manifest icons and ${assets.length} PWA assets`);
