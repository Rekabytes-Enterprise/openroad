import { afterEach, expect, it, vi } from 'vitest';
import { readRouteResponse } from '../src/features/routing/route';
import { POST } from '../src/app/api/routes/route';
const route = { points: [{ lat: 3, lng: 101 }, { lat: 3.1, lng: 101.1 }], distanceMeters: 20, durationSeconds: 10 };
afterEach(() => vi.unstubAllGlobals());
it.each([200, 502])('handles HTML responses without leaking parser errors, status %s', async status => {
  await expect(readRouteResponse(new Response('<!DOCTYPE html><html>Proxy error</html>', { status }))).rejects.toThrow('Route service is temporarily unavailable');
});
it('preserves actionable client errors and valid routes', async () => {
  await expect(readRouteResponse(Response.json({ error: 'Please wait a moment.' }, { status: 429 }))).rejects.toThrow('Please wait a moment.');
  await expect(readRouteResponse(Response.json(route))).resolves.toEqual(route);
});
it.each([200, 502])('proxy converts upstream HTML into a no-store JSON error, status %s', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!DOCTYPE html>bad gateway', { status })));
  const result = await POST(new Request('http://localhost/api/routes', { method: 'POST', body: '{}' }));
  expect(result.status).toBe(502);
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(await result.json()).toEqual({ error: 'Route service is unavailable. Try again.' });
});
it('proxy returns validated route geometry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(route)));
  const result = await POST(new Request('http://localhost/api/routes', { method: 'POST', body: '{}' }));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual(route);
});
