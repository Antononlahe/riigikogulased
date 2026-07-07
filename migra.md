# Migration plan: Vercel -> Coolify on Hetzner

Why: Vercel Hobby meters ISR writes/reads and origin transfer; deploy bursts on a
content-heavy site keep brushing the quota. Self-hosted Next.js uses its filesystem
ISR cache -- no metering, no quota, same `revalidate` semantics. Neon stays; only the
web app moves. The scraper (GitHub Actions -> Neon) is untouched.

Prerequisite done first (regardless of hosting): member pages slimmed from ~1.2MB to
~300KB (defections-only vote payload). This alone may make Vercel viable again; do the
migration when renaming the public URL anyway.

## Target

- Hetzner CX22 (2 vCPU, 4GB, ~4 EUR/mo) or CAX11 (ARM, cheaper). One VPS runs both
  Coolify and the app -- traffic is tiny.
- Coolify (self-hosted, free) as the deploy platform: Git-push deploys, Let's Encrypt,
  reverse proxy (Traefik) built in.
- A real domain (~10 EUR/yr). This replaces parteidistsipliin.vercel.app -- the only
  real switching cost. Keep the Vercel deployment up with permanent redirects for a
  transition period.

## Steps

1. **Buy domain + VPS** (~30 min)
   - Hetzner Cloud console: create CX22, Ubuntu 24.04, add SSH key.
   - Any registrar for the domain; point an A record at the VPS IP (plus `www` CNAME).

2. **Install Coolify** (~15 min)
   - `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash` on the VPS.
   - Open the dashboard, set admin account, connect the GitHub repo (Coolify GitHub App).

3. **Prepare the repo for standalone builds** (~1-2 h, the only real work)
   - `apps/web/next.config.ts`: add `output: "standalone"`.
   - Add `apps/web/Dockerfile` (multi-stage: `corepack pnpm install` -> `pnpm build` ->
     copy `.next/standalone` + `.next/static` + `public` into a slim node image).
     Nixpacks may work without a Dockerfile, but the standalone pnpm-app-in-subdir
     layout is exactly where autodetection gets flaky -- a 20-line Dockerfile is more
     predictable.
   - Note: `next build` prerenders pages that read Neon, so the build needs
     `DATABASE_URL` as a build-time secret (Coolify supports build args/secrets).

4. **Create the Coolify application** (~30 min)
   - Source: the GitHub repo, base directory `apps/web`, Dockerfile build pack.
   - Env vars: `DATABASE_URL` (same Neon URL as Vercel uses).
   - Domain: attach the new domain; Coolify provisions Let's Encrypt automatically.
   - Enable "deploy on push" webhook for `main`.

5. **Verify parity** (~30 min)
   - ISR: confirm pages serve with `x-nextjs-cache: HIT` after first render and
     re-render after `revalidate` expiry. Filesystem cache -- unmetered.
   - Check both locales, member pages, /statistika pages, static member photos.
   - next-intl, Recharts, visx: all plain Node -- no Vercel-specific APIs in the repo
     (no @vercel/og, no edge runtime, no vercel KV/blob), verified 2026-07-07.

6. **Cut over** (~15 min + DNS TTL)
   - Vercel project: keep it, but replace the app with (or add) permanent redirects
     from parteidistsipliin.vercel.app to the new domain. Simplest: a `vercel.json`
     with a catch-all redirect deployed from a tiny branch, so old links keep working.
   - Update the repo README/CLAUDE.md deploy sections.

7. **Ops you now own** (ongoing, ~15 min/mo)
   - Ubuntu unattended-upgrades on; Coolify self-update from its dashboard.
   - Hetzner snapshot or weekly backup (~1 EUR/mo) -- the VPS is stateless apart from
     Coolify config (DB is Neon), so recovery = reinstall + reconnect repo.
   - Uptime check (e.g. free UptimeRobot) since there's no Vercel status page anymore.

## Effort and cost summary

- One-time: ~half a day, dominated by step 3.
- Running: ~5 EUR/mo (VPS + backup) + ~10 EUR/yr domain. Vercel Hobby was free but
  metered; this is flat and unmetered.
- Risks: you own TLS/proxy/OS updates now (Coolify automates most of it); single VPS
  = single point of failure (acceptable for a daily-refresh dashboard).

## Explicitly not doing

- Moving Postgres onto the VPS: Neon free tier works and keeps the scraper pipeline
  and prod DB decoupled from web hosting. Revisit only if Neon limits bite.
- Kubernetes/Docker Swarm/multi-node anything: one small VPS is the right size.
