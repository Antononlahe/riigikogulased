# Progress

**Last updated:** 2026-06-15
**Version target:** v0.2 — A1 (API cutover) and A2 (structural schema) both shipped and live; next is B (design system)
**Branch:** `claude/clever-noether-ch7018`

## Current status

**v0.2 / A2 (structural schema + member enrichment) — DONE and live in production.**
Migration `0002_structure.sql` added `schema_migrations` (+ a `db.apply_migrations()`
runner that `rebuild` invokes), `riigikogu_terms`, `sessions`, `sittings`, `committees` +
`member_committee_terms`, `electoral_districts` + `member_district_terms`, and enrichment
columns on `members` (birth/death/gender/email/phone/seniority/mandate/photo) and `votes`
(`sitting_id`, `draft_uuid/title/mark`). New modules: `enrich.py` (pure transforms incl.
the sitting->session date map with overlap tiebreak), `photo.py` (WebP thumbnails).
`api_models`/`api_cache`/`api_client`/`writer`/`cli` extended; `writer` uses a
`WriteContext`. Sessions are fetched from `/api/sessions` and archived to
`cache/api/sessions.json`; everything else is reproducible offline from the committed cache.
27 offline tests pass, ruff clean. Each task went through two-stage subagent review plus a
final whole-implementation review (READY TO SHIP).

**Production cutover (2026-06-15), validated on an isolated Neon branch first, then applied
in place (TRUNCATE writer tables + `rebuild` + `photos`, same approach as A1):**
598 votes / 51926 ballots / 102 members (unchanged); **discipline 21024 / 20940 / 84 —
byte-identical to before the migration**; 150 sittings (0 unmapped to a session), 176
sessions, 15 committees / 295 committee terms, 13 districts / 234 district terms, 395 votes
with a draft, 101 members enriched, 101 photo thumbnails. The web app (unchanged) surfaces
the new data via ISR within ~1h.

Two bugs were caught during validation and fixed: `apply_migrations` recorded versions
before the tracking table existed on a 0001-only DB (now creates `schema_migrations` up
front); and the operational finding that `rebuild` requires a clean slate (it rebuilds
party terms chronologically) so the cutover must TRUNCATE first, never layer on existing
terms.

## Prior status (A1)

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

**B — design-system foundation**: design tokens + party palette, shadcn/ui, Recharts/visx,
Framer Motion + View Transitions, layout shell, redesigned members table. Now unblocked by
A2's data (member bio, photos, committees, districts). The member-detail UI (vote timeline,
party-switch lines) lives here, not in A2.

### A2 follow-ups (minor, from the final review — not blocking B)

- `member_committee_terms` UNIQUE is `(member_id, committee_id, started_on)`; Postgres
  treats NULL `started_on` as distinct, so a committee membership with no start date would
  not dedupe on a non-truncating re-run. Harmless under the TRUNCATE-first cutover (one
  write per run); consider `UNIQUE NULLS NOT DISTINCT` (PG15+) in a future migration if
  committee terms ever get written outside a clean rebuild.
- `photos` commits `photo_thumb_path` in a single transaction after the whole download
  loop; a network failure mid-loop records nothing (the command is re-runnable from
  scratch). A per-member commit or try/continue would make it more robust.

Spec/plan for A2: `docs/superpowers/specs/2026-06-14-v0.2-a2-structural-schema-design.md`
and `docs/superpowers/plans/2026-06-14-v0.2-a2-structural-schema.md`.

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
