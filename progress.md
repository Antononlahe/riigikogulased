# Progress

**Last updated:** 2026-06-14
**Version target:** v0.2 — API ingestion cutover (A1) shipped; next is A2 (structural schema) or B (design system)
**Branch:** `claude/clever-noether-ch7018`

## Current status

**v0.2 / A1 (API ingestion cutover) is done and live.** Ingestion is now sourced entirely
from the official Open Data API (`api.riigikogu.ee`); the HTML scraping path (parsers,
HTML client, distilled cache, their fixtures/tests) has been **removed**. New modules:
`api_client` (async, hard 1 req/s, 429 backoff), `api_models` (pydantic, API-native),
`api_parse` (slug + decision->choice), `api_cache` (raw-JSON archive under
`apps/scraper/cache/api/`), `writer` (maps API objects into the unchanged v0.1 schema,
preserving party-term tracking). The DB schema and discipline views from
`0001_initial.sql` are unchanged. 10 offline tests green, ruff clean.

**Production cut over and parity-verified.** The 1-year window (`--from 2025-06-14`) was
re-ingested via the API into a Neon branch and diffed against the pre-cutover
HTML-derived numbers, then production was wiped and rebuilt from the committed raw cache.

Production now: **598 votes, 51926 ballots, 102 members**, range 2025-06-16 -> 2026-06-11;
discipline totals counted 21024 / aligned 20940 / defections 84.

**Parity result:** vote count identical (598). The only differences from the HTML baseline
trace to a genuine data improvement — the API captures **Riina Solman** (Isamaa, 221
ballots) whom the HTML scrape had missed entirely. Her inclusion mechanically shifts her 6
Isamaa colleagues' counted/aligned by +-1-2 (the party-line denominator changes for some
Isamaa votes); no other faction is affected. No porting bugs. See the 2026-06-14 log entry.

### Open / follow-ups

1. **GH Actions `DATABASE_URL` secret — DONE (2026-06-14).** Set as an Actions repo secret
   via `gh secret set` (gh 2.94.0 at `C:\Program Files\GitHub CLI\gh.exe`, account
   Antononlahe), value = the validated Neon pooled connection string. The daily cron
   (`scrape.yml`) can now write. Not yet smoke-tested via a manual `workflow_dispatch` run
   (a manual dispatch is a production write — left for the user to trigger or the 05:00 UTC
   cron to exercise).
2. **apps/web redeploy** — code is unchanged; ISR (`revalidate = 3600`) refreshes the live
   site with the new data within the hour. Force a redeploy to surface it immediately.
3. **Deferred cleanups (not blocking):** switch the procedural discriminator from the
   description-derived `vote_type_slug` to the API `type.code`; persist faction/vote-type
   UUIDs. These were intentionally deferred to keep the parity diff honest.

## Next work slice

Pick the next v0.2 sub-project:

- **A2 — structural schema + member enrichment**: migration `0002_*` (riigikogu_terms,
  committees + member_committee_terms, electoral_districts + member_district_terms,
  sessions + sittings), enrich the member record (photo, district, birth year, seniority,
  email/phone), link votes -> sitting. Populated from the already-archived raw API JSON.
- **B — design-system foundation**: design tokens + party palette, shadcn/ui,
  Recharts/visx, Framer Motion + View Transitions, layout shell, redesigned members table.
  Independent of A2; immediately visible.

Specs/plans for A1 live under `docs/superpowers/{specs,plans}/2026-06-14-v0.2-api-cutover*`.

## Roadmap (approved 2026-06-14 — supersedes the old backlog)

A comprehensive roadmap to v1.0-and-beyond was researched and approved. Full document:
`~/.claude/plans/can-you-go-over-crystalline-beacon.md`. Four governing decisions:

1. **Migrate ingestion to the official Open Data API** (`api.riigikogu.ee`, JSON,
   CC-BY-SA, **1 req/sec** limit, spec at `/v3/api-docs`). HTML parsers removed (done in
   A1). The API exposes far more than we scraped: full member bios, committees, terms,
   speeches/stenograms, bills+sponsors, interpellations, written questions, EU docs, a
   **Eurovoc** subject taxonomy, and pre-computed stats.
2. **Design the schema now for four domains** — votes (have), speeches, bills, oversight
   — so later UI is additive, not migratory.
3. **Topic categorization = official Eurovoc tags** (not manual rules / LLM).
4. **UI is first-class from v0.2** — design system + charts (Recharts + visx) + motion
   (Framer Motion + Next.js View Transitions) on the existing Next.js/Tailwind base;
   shadcn/ui.

Expanded ladder: v0.2 API migration + member pages + design system · v0.3 Eurovoc topics
· v0.4 party/committee rollups · v0.5 speeches · v0.6 bills/sponsorship · v0.7 oversight
· v1.0 search/share-cards/historical backfill/polish · post-1.0 "MP activity profiler".
