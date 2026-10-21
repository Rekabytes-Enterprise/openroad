# OpenRoad

A Next.js and TypeScript map PWA built with Leaflet and OpenStreetMap.

Stage one supports map browsing, destination pins, location permission, position accuracy, recentering, installation, and an offline application shell. Driving routes are planned for stage two.

## Run locally

Use Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js. Geolocation requires HTTPS or a browser-trusted loopback origin. Location starts only after a button press. No coordinates are persisted or sent to application analytics.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The build exports static files to `out/` and generates a versioned service worker. Serve that directory with a static HTTP server to check installation and offline launch. The service worker is disabled in development.

## Map provider

`public/map-config.json` is the single source for tile URL, attribution, zoom limits, and initial view. The browser fetches it at runtime. Keep provider attribution visible. Standard OpenStreetMap tiles are configured for this prototype. Read https://operations.osmfoundation.org/policies/tiles/ before public launch and select a provider appropriate to expected traffic. Tiles are not prefetched or cached by our service worker.

Curated Kuala Lumpur destinations are local sample places, not a search API. Dropping a pin uses its coordinates without reverse geocoding.

## PWA limits

After a successful online visit, the production app can launch offline. Unloaded map tiles need connectivity. Tracking pauses while the page is hidden and resumes only if previously enabled. There is no background navigation, trip history, or offline route calculation.

## Architecture

- `src/app`: Next.js page, layout, metadata and responsive CSS.
- `src/features/map`: Leaflet adapter, runtime config validation and coordinate types.
- `src/features/location`: one GPS watcher, permission failures and stale fixes.
- `src/features/navigation`: destination state and interface actions.
- `src/pwa`: install and update controls.
- `scripts/build-worker.mjs`: generates the production shell cache.

The initial PRD proposed Vite. The user selected Next.js before implementation. Stage one uses static export. Stage two will switch to a Next server and add a same-origin routing API, with provider credentials on the server.

Application source is MIT licensed. Map data and dependencies retain their own licenses. See THIRD_PARTY_NOTICES.md.
