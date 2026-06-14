# Progress

**Last updated:** 2026-06-14
**Version target:** v0.1 — sortable members list with overall discipline score
**Branch:** `claude/clever-noether-ch7018`

## Current status

Bootstrap complete: monorepo scaffold, DB schema + discipline views, scraper skeleton,
Next.js app with ET/EN i18n, GitHub Actions for CI and the daily scrape. Schema is
verified against Postgres 16 with synthetic data; web build / typecheck / lint and
scraper ruff / pytest all pass locally.

What does **not** yet work end-to-end:

- Scraper selectors are placeholders — the sandbox where the bootstrap ran is
  firewalled from `riigikogu.ee`, so HTML fixtures haven't been captured yet.
- No real database is connected; `member_discipline` has been validated only against
  synthetic rows in a throwaway local Postgres.
- No deployment target wired up (no Neon project, no Vercel project).

## Next work slice

Goal: first real data flowing into a hosted DB and visible on a deployed dashboard.

1. **Capture live HTML fixtures** for the three parsers and check them into
   `apps/scraper/fixtures/`:
   - `vote_list.html` — one day's vote listing (use a known busy date)
   - `vote_detail.html` — the example UUID from the brief
     (`4785afdf-60cd-428c-b521-a5370d6651bc`)
   - `members.html` — the current Riigikogu members page
2. **Tighten parser selectors** until the three skipped tests in
   `apps/scraper/tests/test_parsers.py` pass.
3. **Provision Neon Postgres**, set `DATABASE_URL` as a GitHub Actions secret + a
   Vercel env var. Apply `packages/db/migrations/0001_initial.sql`.
4. **First backfill**: run `uv run parteidistsipliin-scraper backfill --from 2023-04-10`
   locally to seed the 15th Riigikogu term, then sanity-check the
   `member_discipline` view.
5. **Deploy to Vercel** with the `apps/web` root. Confirm both `/et` and `/en`
   render the table.
6. **Enable the daily scrape workflow** by leaving the cron schedule on
   (already set to 05:00 UTC).

## Backlog (post v0.1, captured for context)

- v0.2: per-member timeline page + party-switch markers
- v0.3: vote-topic categorization
- v0.4: party-level rollup
- v1.0: search, share cards, polish

See `CLAUDE.md > Scope ladder` for the full plan.
