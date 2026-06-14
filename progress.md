# Progress

**Last updated:** 2026-06-14
**Version target:** v0.1 — sortable members list with overall discipline score
**Branch:** `claude/clever-noether-ch7018`

## Current status

**v0.1 is deployed, live, and showing the complete 15th-term dataset** at
https://parteidistsipliin.vercel.app — both `/et` and `/en` render the sortable
members table from real Neon data. The scraper parses real Riigikogu HTML (commits
`1b26513`, `46530cd`, 21 tests green), Neon holds the full backfill
(2,187 votes / 173k ballots / 101 members, 2023-04-10 → 2026-06-11), and the page is
ISR-cached with a 1h revalidate so the daily cron's new votes appear automatically.

Done this session:

- **Fixtures + parsers** — `apps/scraper/fixtures/{vote_list,vote_detail,members}.html`
  committed; `cli.py`/parsers rewritten (see log entry for `1b26513`). Listing uses
  `startFrom`/`endTo`; `vote_type_slug` derived from the vote **title**; member key is
  the `/saadik/<uuid>/` segment.
- **Neon** — project `parteidistsipliin` (`rapid-star-29400137`, db `neondb`, pooled
  `us-west-2`). `0001_initial.sql` applied: 6 tables, 3 views, seeds present,
  `member_discipline` queryable. Pooled `DATABASE_URL` in gitignored
  `apps/scraper/.env`.
- **Vercel** — DEPLOYED. Project `parteidistsipliin`
  (`prj_j111iI8XkWuKyYH9FYrFOmVGlYKI`), live at https://parteidistsipliin.vercel.app;
  `/et` + `/en` render the table. `DATABASE_URL` set for the production target.
- **Backfill** — COMPLETE. Full 15th term ingested (2,187 votes, 607 procedural, 173k
  ballots, 101 members, 100 scored). Discipline spreads sensibly: e.g. Alar Laneman
  (EKRE) 41% over 901 counted votes; independents correctly excluded.
- **Live-data staleness** — the first deploy static-rendered mid-backfill (showed 452
  max / 19 scores). The page already sets `revalidate = 3600`; a redeploy after the
  backfill refreshed the baseline, and the site now matches the DB (982 max / 38
  scores). Going forward ISR + the daily cron keep it current with no manual redeploy.

Not done yet:

- **GitHub Actions** — `DATABASE_URL` secret not set, so the daily scrape (scrape.yml)
  can't write yet. Needs the secret added in the GitHub repo (no `gh` CLI installed).
- **Vercel preview env** — `DATABASE_URL` only set for `production`; the `preview`
  target add hit a confirm prompt and didn't land (only matters for PR preview deploys).

### Known follow-ups (non-blocking for v0.1)

1. Scraped faction strings are full names ("Eesti Reformierakonna fraktsioon"), so they
   don't reconcile with the seeded RE/EKRE abbreviations — seed party rows go unused.
   Cosmetic; revisit if the dashboard should show abbreviations.
2. `cli.py members` fetches `/riigikogu-liikmed/`; real path is
   `/riigikogu/koosseis/riigikogu-liikmed/`. Not on the backfill path; fix before
   relying on the standalone `members` refresh.
3. Confirm choice mapping `Ei hääletanud → neutral`, `Puudub → absent` (does not affect
   the score — both are excluded from counted votes).
4. CLAUDE.md "Core metric" / data-model notes still say the slug is URL-derived and
   describe member IDs loosely — reconcile in the next docs pass (slug is title-derived;
   member natural key is the saadik UUID).

## Next work slice

Goal: first real data in the hosted DB, visible on a deployed dashboard.

1. **DONE — Capture live HTML fixtures** (`apps/scraper/fixtures/`).
2. **DONE — Fix parsers** (commit `1b26513`, 14 tests green).
3. **DONE — Provision Neon + apply schema.**
4. **DONE — Backfill verified** on 11.06.2025; full term `--from 2023-04-10` running in
   the background.
5. **DONE — Deploy to Vercel** (`apps/web` root). Both `/et` and `/en` render the table
   at https://parteidistsipliin.vercel.app, `DATABASE_URL` set for production.
6. **TODO — Enable the daily scrape** by setting the GH Actions `DATABASE_URL` secret;
   cron is already on (05:00 UTC). This is the last v0.1 item.

## Backlog (post v0.1, captured for context)

- v0.2: per-member timeline page + party-switch markers.
  Data source candidate: per-member endpoint
  `/tegevus/tooulevaade/haaletused/saadiku-haaletused/?saadik=<member-uuid>` returns a
  single member's vote history server-side (accepts `startFrom`/`endTo`). Not needed
  for v0.1 (detail pages already carry every member's ballot), but a clean feed for the
  timeline.
- v0.3: vote-topic categorization
- v0.4: party-level rollup
- v1.0: search, share cards, polish

See `CLAUDE.md > Scope ladder` for the full plan.
