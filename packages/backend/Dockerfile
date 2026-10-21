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
COPY packages/backend packages/backend
RUN pnpm --filter @openroad/backend build
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=4205
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/backend ./packages/backend
USER node
EXPOSE 4205
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "packages/backend/dist/index.js"]
