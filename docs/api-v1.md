# OpenRoad API v1

Native Android base URL after deployment: `https://be-openroad.techapi.my/api/v1`.
Web clients use same-origin `/api/v1`; Next.js forwards to the Hono backend via
`BACKEND_URL`, which stays the backend origin without a path suffix.

These endpoints are implemented locally. Deployment is required before Android
clients can use v1 in production. No API key or user authentication is implemented.
Use HTTPS in production. Native clients do not depend on browser CORS.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Backend liveness, not an upstream provider check |
| POST | `/places/search` | Find places using Photon |
| POST | `/routes` | Calculate an OSRM driving route |

Send `Content-Type: application/json` for POST requests. Request bodies are limited
to 2 KiB. Coordinates are named `{ "lat": number, "lng": number }`, latitude
between -90 and 90, longitude between -180 and 180. Both must be finite.

## Health

```json
{"status":"ok","service":"openroad-backend"}
```

## Place search

```json
{"query":"KLCC","proximity":{"lat":3.1579,"lng":101.7123}}
```

`query` is trimmed and must contain 3–160 characters. `proximity` is optional or
null. When supplied, matches inside 5 km are prioritized and ordered nearest first,
then wider matches fill the remaining slots. This is not exhaustive POI discovery;
Photon relevance, data coverage and result limits still apply.

The response contains zero to eight places:

```json
{"places":[{"id":"osm:N:123","name":"Example place","detail":"Kuala Lumpur, Malaysia","point":{"lat":3.1579,"lng":101.7123}}]}
```

The example place ID is illustrative. Use returned coordinates to select a
routing destination. Search has an eight-second provider deadline and at most
eight active search requests per backend process. Suggested client timeout: 12 seconds.

The web app debounces input by 300 ms and caches up to 50 successful searches for
five minutes in tab memory, keyed by query and location. That cache is not a backend
cache; Android must implement its own if needed. Cancel superseded searches.

## Driving route

```json
{"origin":{"lat":3.1486,"lng":101.6935},"destination":{"lat":3.155,"lng":101.713}}
```

Origin and destination must differ. Response shape:

```json
{"points":[{"lat":3.1486,"lng":101.6935},{"lat":3.155,"lng":101.713}],"distanceMeters":4000,"durationSeconds":600}
```

The numbers above illustrate the contract, not a real computed route. Draw the
returned ordered `points` as the route polyline. Distances are meters and durations
are seconds. This is a route preview without traffic, turn instructions or live
navigation. Routing is throttled to one accepted request per 1.1 seconds across
all clients in each backend process. Suggested client timeout: 20 seconds.

## Errors

Errors use `{ "error": "Human-readable message" }`. Handle status codes rather
than matching message text; wording may change. Proxies can return non-JSON errors,
so validate content before decoding.

| Status | Meaning |
| --- | --- |
| 400 | Malformed JSON or invalid input |
| 404 | Unknown endpoint or no driving route |
| 413 | Request body exceeds 2 KiB |
| 429 | Busy or throttled; respect `Retry-After` seconds |
| 502 | Provider/proxy failure or invalid provider response |
| 503 | Provider not configured |
| 504 | Provider timeout |

Do not retry invalid requests. Offer retry for temporary failures and respect
rate limits. Search and route responses use `Cache-Control: no-store`.

## Compatibility and privacy

Backend `/health`, `/places/search`, `/routes` and frontend `/api/health`,
`/api/places/search`, `/api/routes` remain compatibility aliases. New clients use
v1. Deploy the backend before the frontend because the updated proxy calls v1.
No automatic fallback to legacy endpoints is performed.

Additive response fields may be introduced in v1; clients should ignore unknown
fields. Breaking request/response changes should use a new version and retain v1
while supported mobile releases depend on it.

Nearby search sends user location to the backend and Photon; routing sends both
endpoints to OSRM. OpenRoad does not persist or log coordinates. Infrastructure
and provider logs are configured separately. Do not embed server credentials or
Photon/OSRM configuration in the Android app.
