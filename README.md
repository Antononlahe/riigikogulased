# parteidistsipliin

Dashboard tracking how often Estonian Riigikogu members vote with — or against — their party.

Data source: [Riigikogu vote archive](https://www.riigikogu.ee/tegevus/tooulevaade/haaletused/).

## Status

v0.1 in progress. Scope: scrape the 15th Riigikogu (2023-), compute each member's
discipline score (share of votes aligned with their party's majority), and serve a
sortable members list.

## Stack

- **Web**: Next.js 15 (App Router, TypeScript), Tailwind v4, next-intl (ET + EN). Deploys to Vercel.
- **Scraper**: Python 3.11+ (httpx + selectolax + psycopg + typer), managed with [uv](https://docs.astral.sh/uv/).
- **Database**: Postgres (Neon recommended).
- **Scheduling**: GitHub Actions cron runs the scraper daily.

## Quickstart

```bash
# 1. Install web deps
pnpm install

# 2. Install scraper deps (requires uv: https://docs.astral.sh/uv/)
pnpm scrape:install

# 3. Point at a Postgres database
cp .env.example .env  # edit DATABASE_URL

# 4. Apply schema
pnpm db:migrate

# 5. Seed historical votes (one-off; takes a while)
pnpm scrape -- backfill --from 2023-04-10

# 6. Run the web app
pnpm dev
```

## Layout

```
apps/
  web/        Next.js dashboard
  scraper/    Python scraper (CLI + library)
packages/
  db/         SQL migrations and views
.github/
  workflows/  CI + scheduled scrape
```

See `CLAUDE.md` for design notes and conventions when extending the project.
