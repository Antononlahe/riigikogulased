# Progress

**Last updated:** 2026-06-15
**Version target:** v0.2 — A1, A2, B all DONE and signed off. A new data-accuracy slice —
**erakond ↔ fraktsioon reconciliation** — was discovered and is now the current slice; it
sits before C (member-detail page).
**Branch:** `claude/clever-noether-ch7018`

## Current status

**v0.2 / erakond reconciliation — DESIGN APPROVED, spec written, awaiting spec review.**
Discovered while triaging a reported bug (Alar Laneman shows 0 votes). Root cause: the
Riigikogu API carries only **fraktsioon** (parliamentary faction), never **erakond** (party)
membership — verified, no party field anywhere in the member record. 17 of 102 members are
`Fraktsiooni mittekuuluvad` (non-attached) for the whole window, so they get `party_id =
NULL` and are excluded from discipline (0 counted votes). Several are prominent (Kiik, Aab,
Mölder, Põlluaas, Kunnas). Not a code bug — the API is missing the fact. Fix: add a second
ingestion source, the **äriregister (RIK) party-member registry** (server-rendered HTML at
`ariregister.rik.ee/est/political_party/`, the only available source — no bulk file, no
API), matched to Riigikogu members by **name + date_of_birth**, to supply erakond terms.
Scoring rule (locked): scoring party = fraktsioon's party when in a faction, else erakond,
else excluded; the party **line** is defined by **faction members only**. Spec:
`docs/superpowers/specs/2026-06-15-v0.2-erakond-fraktsioon-reconciliation-design.md`. The
visible "party member, not in faction" indicator is deferred to C; this slice produces the
data + corrected scoring. **Next:** user reviews the spec, then writing-plans → implement.

## Prior status (B)

**v0.2 / B (design-system foundation + members table) — DONE, deployed, and signed off
(2026-06-15).** Editorial/broadsheet direction. `apps/web` has a CSS-variable token layer
(light + dark via `@theme inline`), the locked six-party palette (RE/EKRE/KE/E200/SDE/I as
fill + ink, dark tones lifted), shadcn/ui (button, dropdown-menu), next-themes (class +
system default), self-hosted fonts (Source Serif 4 + Inter), Framer Motion (reduced-motion
aware) and CSS `@view-transition`. The members list is a sortable/filterable enriched table
(photo avatar, party badge, discipline bar, `aria-sort`, party filter). Pure logic is
unit-tested (`lib/party.ts`, `lib/members.ts` — 9 vitest tests); `getMemberDiscipline` gained
`photoThumbPath`. Spec/plan:
`docs/superpowers/specs/2026-06-15-v0.2-b-design-system-design.md` and
`docs/superpowers/plans/2026-06-15-v0.2-b-design-system.md`.

Verified green before deploy: typecheck, `next lint`, 9 tests, production build (5/5 static
pages, 0 `MISSING_MESSAGE`), dev server HTTP 200 with the editorial shell. A latent i18n bug
was fixed during integration (`NextIntlClientProvider` now receives `messages` via
`getMessages()` — next-intl v3 doesn't auto-inherit). **Deployed and live-verified by the
user (theme toggle, row motion, responsive widths, the populated real-data table) — signed
off.**

## Prior status (A2)

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

1. **GH Actions `DATABASE_URL` secret — BROKEN, fix deferred to next session.** The secret
   was set 2026-06-14, but the first cron run (`Scheduled scrape`, run 27528969102, 05:00
   UTC 2026-06-15) **failed**: psycopg `ProgrammingError: invalid connection option
   "﻿…neondb?channel_binding"`. Root cause: the secret value has a leading **UTF-8 BOM
   (U+FEFF)** — almost certainly set from a PowerShell-written file (Out-File/Set-Content/`>`
   default to BOM). The BOM makes psycopg miss the `postgresql://` URI scheme and fall back
   to keyword=value parsing, so the whole URL becomes an invalid option. The connection
   string itself is fine. The workflow (`scrape.yml:20`) passes the secret straight to env,
   so the BOM is in the stored secret, not the YAML. **Fix (run from Git Bash, NOT
   PowerShell, to avoid re-adding a BOM):**
   `printf '%s' '<neon pooled conn string>' | gh secret set DATABASE_URL --repo Antononlahe/parteidistsipliin`
   then smoke-test: `gh workflow run scrape.yml -f command=daily` and confirm green.
2. **apps/web redeploy** — code is unchanged; ISR (`revalidate = 3600`) refreshes the live
   site with the new data within the hour. Force a redeploy to surface it immediately.
3. **Deferred cleanups (not blocking):** switch the procedural discriminator from the
   description-derived `vote_type_slug` to the API `type.code`; persist faction/vote-type
   UUIDs. These were intentionally deferred to keep the parity diff honest.

## Next work slice

**C — member-detail page**: per-member route (`/[locale]/members/[slug]`) with the vote
timeline + with/against-party markers + party-switch lines (visx/D3 — added in C, not B),
built on B's design-system foundation. The members-table rows become links into it (plain
text in B). Scoped out of B deliberately; B delivers tokens + palette + shell + the enriched
list. Before starting C, close out B: deploy `apps/web` and do the visual/interactive
verification that needs a live DB (theme toggle, row motion, responsive widths, populated
table).

### B follow-ups (minor, from review — not blocking C)

- `MembersTable`: new-column sort always starts ascending (worst-first for discipline,
  matches the SQL default); reconsider per-column default direction if UX feedback wants
  most-defections-first. `aria-sort` is wired; consider visible sort affordance polish.
- `NextIntlClientProvider` is passed the full `messages` object; could `pick` only the
  client namespaces (theme/locale/table/filter) to trim the client payload if it ever grows.
- Member names render as plain text in B; wrap in locale-aware `Link` when C lands the
  detail route.

### A2 follow-ups (minor, from the final review — not blocking B/C)

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

Future work (post-1.0, requested 2026-06-15): **committee-level party discipline** — run
the discipline metric over committee votes (`/api/votings/committees`) to show how loyal
members are to the party line within committees, per committee and per member. Recorded in
the roadmap doc.
