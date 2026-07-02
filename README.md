# Riigikogulased

Dashboard tracking how often Estonian Riigikogu members vote with — or against — their party.

Live: https://parteidistsipliin.vercel.app

Data: [Riigikogu Open Data API](https://api.riigikogu.ee), attributed under CC-BY-SA 3.0.

## Stack

- **Web** (`apps/web`): Next.js App Router + Tailwind + next-intl (ET/EN), on Vercel.
- **Scraper** (`apps/scraper`): Python + [uv](https://docs.astral.sh/uv/); writes to Postgres.
- **Database**: Postgres (Neon). SQL migrations + views in `packages/db`.
- **Cron**: GitHub Actions runs the scraper daily.

The scraper writes; the web app only reads.

## Develop

```bash
pnpm -C apps/web install       # web deps
pnpm -C apps/web dev           # run the dashboard

cp .env.example .env           # set DATABASE_URL
pnpm db:migrate                # apply schema
pnpm scrape:install            # scraper deps (needs uv)
pnpm scrape -- backfill --from 2023-04-10   # seed votes (slow, one-off)
```

## Layout

```
apps/web/        Next.js dashboard
apps/scraper/    Python scraper (CLI + library)
packages/db/     SQL migrations and views
```

See `CLAUDE.md` for design notes and conventions.
