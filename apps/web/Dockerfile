# Build context = apps/web (Coolify base directory).
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# next build prerenders member pages from Neon (generateStaticParams),
# so DATABASE_URL must be present at build time.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
# Cap V8's heap so the build GCs early instead of ballooning to the ~2GB default and getting
# OOM-killed on the 2GB VPS (which also runs prod Postgres + the live app during the build).
RUN NODE_OPTIONS=--max-old-space-size=1536 pnpm build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# wget for Coolify's container healthcheck (the slim image ships neither curl nor wget).
RUN apt-get update && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
