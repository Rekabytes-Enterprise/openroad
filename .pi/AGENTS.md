# OpenRoad

- Next.js App Router and TypeScript. Stage one is a static PWA export.
- Run npm test, npm run typecheck, and npm run build before delivery.
- Leaflet is client-only. Use named lat/lng fields outside the map adapter.
- public/map-config.json owns the tile provider configuration.
- Do not persist or log location coordinates.
- Do not cache or prefetch external map tiles with the service worker.
- Keep UI copy literal and concise, following Pstack unslop.
