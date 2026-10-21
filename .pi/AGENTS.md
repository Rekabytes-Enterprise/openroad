# OpenRoad

- Work locally by default. Build, preview and screenshot requests do not authorize remote uploads, Git pushes, repository publication or deployment, including private previews.
- Use ChatGPT Sites or another hosting service only when the user explicitly requests that service and action. Skill defaults never supply user consent.
- "Open source it" describes the intended license and future distribution; do not infer permission to publish now.
- Never retry a rejected push or deployment without a new explicit user request.

- Next.js App Router and TypeScript. pnpm workspace with standalone frontend and Hono backend.
- Run pnpm test, pnpm typecheck, and pnpm build before delivery.
- Leaflet is client-only. Use named lat/lng fields outside the map adapter.
- packages/frontend/public/map-config.json owns the tile provider configuration.
- Do not persist or log location coordinates.
- Do not cache or prefetch external map tiles with the service worker.
- Keep UI copy literal and concise, following Pstack unslop.

- Before work, recall relevant Omni-graph memories and verify them against current files.
- CI runs only on dev pushes and PRs targeting dev. Docker publication runs on stable GitHub Release publication, never tag creation/push or branch pushes. Both images must receive version and latest tags. Inspect the referenced project workflow before adapting it; explicit user instructions win over differences in that reference.
