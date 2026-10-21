import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { drivingRoute, parseInput, RouteError, type RouteInput, type DrivingRoute } from './routes/routing.js';

export function createApp(calculate: (input: RouteInput) => Promise<DrivingRoute> = drivingRoute) {
  const app = new Hono();
  // Global prototype budget: no IP addresses or coordinates retained for throttling.
  let nextRequest = 0;
  app.get('/health', c => c.json({ status: 'ok', service: 'openroad-backend' }));
  app.use('/routes', bodyLimit({ maxSize: 2048, onError: c => c.json({ error: 'Request is too large.' }, 413) }));
  app.post('/routes', async c => {
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
  app.notFound(c => c.json({ error: 'Not found' }, 404));
  return app;
}
export const app = createApp();
