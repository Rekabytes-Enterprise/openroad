import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : join(directory, entry.name)))).flat();
}
const publicPaths = (await files('public')).filter(path => !path.endsWith('sw.js'));
const staticPaths = await files('.next/static');
const digest = createHash('sha256');
for (const path of [...publicPaths, ...staticPaths].sort()) digest.update(await readFile(path));
digest.update(await readFile('.next/server/app/index.html'));
const cacheName = `openroad-${digest.digest('hex').slice(0, 12)}`;
const urls = [...publicPaths.map(path => path.replace(/^public/, '')), ...staticPaths.map(path => path.replace(/^\.next/, '/_next')), '/'];
await writeFile('public/sw.js', `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('openroad-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/').then(response => response || Response.error())));
    return;
  }
  if (url.pathname === '/map-config.json') {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
      return response;
    }).catch(() => caches.match(event.request).then(response => response || Response.error())));
    return;
  }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
`);
console.log(`Service worker caches ${urls.length} application files. External tiles are excluded.`);
