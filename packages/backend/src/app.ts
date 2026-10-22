import { parseSearch, searchPlaces, SearchError, type Place, type SearchInput } from './routes/search.js';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { drivingRoute, parseInput, RouteError, type RouteInput, type DrivingRoute } from './routes/routing.js';

export function createApp(calculate: (input: RouteInput) => Promise<DrivingRoute> = drivingRoute, search: (query: SearchInput) => Promise<Place[]> = searchPlaces) {
  const app = new Hono();
  const v1 = new Hono();
  // Global prototype budget: no IP addresses or coordinates retained for throttling.
  let nextRequest = 0;
  v1.get('/health', c => c.json({ status: 'ok', service: 'openroad-backend' }));
  v1.use('/routes', bodyLimit({ maxSize: 2048, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  v1.post('/routes', async c => {
    c.header('Cache-Control', 'no-store');
    try {
      let body: unknown;
      try { body = await c.req.json(); } catch { throw new RouteError(400, 'Expected a JSON request.'); }
      const input = parseInput(body);
      if (Date.now() < nextRequest) { c.header('Retry-After', '1'); return c.json({ error: 'Please wait a moment before requesting another route.' }, 429); }
      nextRequest = Date.now() + 1100;
      return c.json(await calculate(input));
    } catch (error) {
      if (error instanceof RouteError) return c.json({ error: error.message }, error.status);
      return c.json({ error: 'Route calculation failed.' }, 502);
    }
  });
  let activeSearches = 0;
  v1.use('/places/search', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  v1.use('/places/search', bodyLimit({ maxSize: 2048, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  v1.post('/places/search', async c => {
    let query: SearchInput;
    try {
      let body: unknown;
      try { body = await c.req.json(); } catch { throw new SearchError(400, 'Expected a JSON request.'); }
      query = parseSearch(body);
    } catch (error) {
      return c.json({ error: error instanceof SearchError ? error.message : 'Invalid search.' }, 400);
    }
    if (activeSearches >= 8) { c.header('Retry-After', '1'); return c.json({ error: 'Search is busy. Try again.' }, 429); }
    activeSearches++;
    try { return c.json({ places: await search(query) }); }
    catch (error) {
      if (error instanceof SearchError) return c.json({ error: error.message }, error.status);
      return c.json({ error: 'Place search is unavailable. Try again.' }, 502);
    } finally { activeSearches--; }
  });
  // Mount the same handlers so legacy and v1 clients share rate limits.
  app.route('/api/v1', v1);
  app.route('/', v1);
  app.notFound(c => c.json({ error: 'Not found' }, 404));
  return app;
}
export const app = createApp();
