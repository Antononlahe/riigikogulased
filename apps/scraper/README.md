# Scraper

Python CLI that crawls the Riigikogu vote archive and writes to Postgres.

## Setup

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync                    # install deps + create .venv
cp ../../.env.example .env # or symlink the root .env
```

## Commands

```bash
# Backfill a date range (inclusive). Idempotent — rerunning skips
# votes already in the DB.
uv run parteidistsipliin-scraper backfill --from 2023-04-10 --to 2024-12-31

# Scrape just yesterday's sittings. Designed for GitHub Actions cron.
uv run parteidistsipliin-scraper daily

# Refresh members + current party affiliations.
uv run parteidistsipliin-scraper members
```

## Layout

- `api_client.py` — polite async httpx client for api.riigikogu.ee (1 req/s throttle, 429/5xx +
  transport-error retries, CC-BY-SA User-Agent). `ariregister_client.py` is the sibling client
  for the äriregister party registry.
- `api_parse.py` / `api_models.py` — pydantic models + helpers that turn API JSON into rows.
- `db.py` — psycopg-based writers (`upsert_member`, `write_voting`, `apply_migrations`, …).
- `cli.py` — Typer commands (`backfill`, `daily`, `members`, `erakond`, `eurovoc`, `rebuild`, …)
  that wire client + parse + db together.

The `parsers/` package is an empty placeholder: the HTML parsers were removed in the v0.2 API
cutover. Reintroduce one only if a concrete API data gap appears.

## Tests

`pytest` runs offline against committed fixtures under `fixtures/api/` and the raw cache under
`cache/`; no test hits the network. `rebuild` replays the committed cache to reproduce the DB
with no network access.
