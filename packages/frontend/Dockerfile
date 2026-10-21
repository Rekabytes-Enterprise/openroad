# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate
WORKDIR /app
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN pnpm install --frozen-lockfile
FROM deps AS build
COPY packages/frontend packages/frontend
WORKDIR /app/packages/frontend
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=4206 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/packages/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=build --chown=node:node /app/packages/frontend/public ./packages/frontend/public
USER node
EXPOSE 4206
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "packages/frontend/server.js"]
