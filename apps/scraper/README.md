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

- `client.py` — polite httpx client (rate-limit, retries, identifies via User-Agent).
- `parsers/` — pure parser functions: `(html: str) -> pydantic model`. Tested against
  fixtures.
- `db.py` — psycopg-based writers. `upsert_vote`, `upsert_member`, etc.
- `cli.py` — Typer commands that wire client + parsers + db together.

## Parser status

The selectors in `parsers/*.py` are stubs — the sandbox where this repo was
bootstrapped could not reach `riigikogu.ee`. Run the scraper against the real site
once and update the CSS selectors / JSON paths to match. Each parser has a `# TODO:
verify against live HTML` marker.

## Tests

`pytest` runs the parsers against committed HTML fixtures under `fixtures/`. To add a
new fixture: grab the page with `curl -A "$SCRAPER_USER_AGENT" <url> >
fixtures/<name>.html` and write a corresponding `tests/test_*.py` case.

Tests do **not** hit the network.
