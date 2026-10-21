import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = Number(process.env.PORT ?? 4205);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
const server = serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? '0.0.0.0' });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
