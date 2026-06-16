# Progress

**Last updated:** 2026-06-16
**Version target:** v0.3 (Eurovoc topics). **D1 + D2 are DONE and LIVE in prod** —
https://parteidistsipliin.vercel.app. v0.2 (A1/A2/B/erakond/C/active-members) also done and live.
**Branch:** `claude/clever-noether-ch7018`

## Current status

**v0.3 / D2 (topic explorer UI) — DONE + LIVE IN PROD (2026-06-16).** Built via subagent-driven
development (spec/plan `docs/superpowers/{specs,plans}/2026-06-16-v0.3-d2-topic-explorer*`). A
dedicated, **removable** `/teemad` explorer over D1's `vote_topics`: descriptor-unit index (default
≥5 scored votes, search reaches the rest), per-topic ranked discipline table (members with ≥3
votes-on-topic; counts shown so low-N is visible) + the bills behind each topic. Site is now
**Estonian-first** (`localePrefix: "as-needed"` + `localeDetection: false`): `/` always Estonian,
English opt-in at `/en/...`, `/et/...` redirects to unprefixed. Field/microthesaurus shown only when
present (top descriptors are narrower Eurovoc terms with null English label + null field →
`topicLabel` falls back to Estonian, "no broad field" note — honest).

**Discipline definition unchanged.** During the deploy, per-topic queries over the
`member_vote_alignment` view proved too slow to prerender (~9s/page — the view recomputes
party-at-time for all ~50k ballots). Fix: migration **`0006`** adds a `ballot_alignment` materialized
view (cache of the view, indexed by `vote_id`), refreshed after each ingest (`db.refresh_alignment`);
new `migrate` CLI command applies migrations without a full rebuild. Topic queries repointed to the
matview: **9027ms → 18ms**. Live + verified: `/teemad`, `/teemad/[edid]` (ranking + bills),
`/en/teemad`, `/topics`→`/teemad` all 200/redirect; scraper ruff + 64 tests, web typecheck + 26
tests green.

**Next slice:** v0.4 (party/faction/committee cohesion rollups). Open follow-up still: broad-field
faceting covers ~38% of bills (D1 `narrowTerms` crawl) if field-level facets are ever wanted.

## Prior status (v0.3 / D1 — Eurovoc ingestion)

**v0.3 / D1 (Eurovoc topic ingestion) — DONE + LIVE IN PROD (2026-06-16).** Built via
subagent-driven development (plan `docs/superpowers/plans/2026-06-15-v0.3-d1-eurovoc-ingestion.md`,
spec alongside). Migration `0005_eurovoc.sql` (4 tables `eurovoc_fields`/`eurovoc_microthesauri`/
`eurovoc_descriptors`/`volume_topics` + the `vote_topics` view) with `db` upserts; pure mappers
`eurovoc_models.py` (unit-tested); `eurovoc_cache.py` git-committed raw-JSON archive
(unit-tested + real-shape fixture tests); writer `write_eurovoc_taxonomy`/`write_volume_topics`;
the `eurovoc` CLI command (taxonomy fields+microthes et+en, then per-`draft_uuid` descriptors →
`volume_topics`); and `rebuild` replay of the eurovoc+draft caches. **64 offline tests pass.**

**Validated on Neon branch then cut over to prod (additive — discipline unchanged):** migrations
`0001–0005`; **21 fields, 127 microthesauruses, 1043 descriptors, 233/233 bills linked, 1052
topic links, 1828 `vote_topics` rows, 0 orphans, discipline counted 23166 (unchanged)**. The
taxonomy+drafts raw cache is committed so offline `rebuild` reproduces `volume_topics`.

**Known limitation (decided: ship as-is).** Descriptor-level topic filtering is complete (100%
of bills), but broad-**field** rollup covers only **88/233 bills (38%)**: Eurovoc descriptors are
hierarchical and bills cite **narrower** descriptors that the `/api/eurovoc/microthes` endpoint
omits, with no usable ancestry (`hierPaths`/`broaderTerms`/`microThesauruses` empty), so they are
captured as draft-only (`microthesaurus_etid NULL`, no field). Lifting field coverage would need
a recursive `narrowTerms` crawl — deferred to its own slice if D2 wants field-level facets.

**Bug fixed during the live run:** `_refresh_eurovoc` held an idle Neon connection through the
~4-min taxonomy fetch and the pooler dropped it ("SSL connection has been closed unexpectedly").
Fixed by fetching the taxonomy into the cache first (no connection held), opening the DB only for
the write + (interleaved) draft phases.

**Outstanding:** the Neon validation branch `br-restless-river-a696s26g` (project
rapid-star-29400137) can be deleted once you're confident (Neon deletes are user-gated). The web
app surfaces nothing new yet — D2 is the topic UI.

## Prior status (active members)

**v0.2 / active members + cycle label — DONE + LIVE (2026-06-15).** `members.active` (migration
`0004`); the `members`/`rebuild` reconciliation marks DB members absent from the active list as
former and enriches them from the per-member endpoint (only Riina Solman); web shows inactive
members muted + `endine`-tagged in the ranked list, a "former member" note + de-emphasis on the
detail page, and a static `XV Riigikogu · 2023–` cycle label. Cut over to prod (101 active / 1
former; Solman's bio populated; discipline unchanged) and redeployed. A follow-up fix preserves
former members' last faction (`set_faction=False`) so Solman shows Isamaa-greyed, not
Fraktsioonitu. Spec/plan: `docs/superpowers/{specs,plans}/2026-06-15-v0.2-active-members*`.
Multi-cycle grouping + historical backfill remain **v1.0**; all-time stats **post-1.0**.

## Prior status (C member-detail page)

**v0.2 / C (member-detail page) — CODE COMPLETE + BUILD-VALIDATED.** Built via subagent-driven
development (plan `docs/superpowers/plans/2026-06-15-v0.2-c-member-detail-page.md`):
`/[locale]/members/[slug]` route (ISR, `generateStaticParams`, View Transition from the
list), `getMemberDetail(slug)` query, pure tested `lib/member-detail.ts` (classify/monthly/
switches — 9 vitest tests), components (member-header with the **"party member · not in
faction"** chip, discipline-summary, **per-party-at-time** breakdown, affiliations/bio
panel), and the **visx** vote-timeline (monthly trend + per-vote strip + party-switch guides
+ tooltip + a11y). Members-table names now link into it. i18n et+en added.
**Verified:** 18 vitest tests pass, tsc clean, `next lint` clean, and the **production build
generated 209/209 static pages** — including all ~204 member pages (102 × 2 locales)
prerendered against live branch data with the timeline rendered server-side, 0
`MISSING_MESSAGE`; member-page bundle 30.4 kB / 199 kB First Load. A date-handling bug (pg
returns DATE/TIMESTAMP as JS `Date`, components `.slice()` strings) was caught by the build
and fixed (`::text` casts). **Final whole-slice review (opus): PASS, "ready to deploy", no
must-fixes.** **Still to do:** deploy + interactive verification (timeline hover/keyboard,
View Transition, responsive) against a live DB, as with B.

C optional polish (non-blocking, from final review): precompute `classifyVote` once in the
timeline `useMemo` (it runs per-mark on ~600 rects); `Promise.all` the four independent
queries in `getMemberDetail` (faster cold prerender of ~204 pages); rename the `senorityDays`
typo → `seniorityDays`. Known limitation: switches into/out of the non-attached bench produce
no timeline guide (the votes series only contains scored votes).

## Prior status (erakond reconciliation)

**v0.2 / erakond reconciliation — IMPLEMENTED + BRANCH-VALIDATED; prod cutover + cache
persistence remain.** Built via subagent-driven development (Tasks 1-12 of the plan
`docs/superpowers/plans/2026-06-15-v0.2-erakond-fraktsioon-reconciliation.md`): äriregister
client/parser/cache/models, migration `0003` (faction/erakond split + reworked discipline
views), db/writer/CLI wiring, web `in_faction`. Validated on Neon branch
`br-empty-dust-a6abd6s5` (project rapid-star-29400137): **matched 96/101 members**;
non-attached zero-scorers dropped **17 -> 4** (the 4 are correctly excluded: Valge=ERK
non-parliamentary, Grünthal/Mölder=no current party, Kunnas=no registry party); faction
members byte-identical; discipline totals 21024/20940/84 -> **23166/23044/122** (the deltas
are the newly-scored non-attached members' real party-line votes). 53 offline tests green,
ruff clean.

Branch validation caught two real bugs (fixed, commit on branch): (1) four of six seeded
party **registration codes were wrong** (KE/E200/SDE/I) -> mis-mapped parties; corrected
against the live registry + added a party display-name resolver. (2) the registry only
shows a "member history" link for people with a **multi-party history**, so single-stable-
membership members (Eesmaa, Sarapuu) were dropped; the parser now emits card-only candidates
and the importer builds a term from the search card. See progress-log.

**Remaining before done:**
1. **äriregister cache persistence — DONE (gzip).** Cache committed gzip-compressed
   (`apps/scraper/cache/ariregister/*.html.gz`, ~2.6MB vs 31MB raw); `AriregisterCache`
   reads/writes gzip. Reproducibility re-verified from the gzipped cache (same 96/101
   matches, same 23166/23044/122 totals).
2. **Prod cutover — DONE (2026-06-15, with user permission).** A minimal, non-destructive
   cutover (NOT a wipe-and-rebuild — 0003 only renames `member_party_terms` ->
   `member_faction_terms` preserving data, adds `member_erakond_terms` + views): took a
   backup branch `pre-erakond-cutover-backup` (`br-cool-paper-a6qe3aqm`), applied `0003` to
   prod via `db.apply_migrations`, then ran `erakond` (offline from the committed gzip cache,
   matched 96/101). Verified on prod: migrations 0001/0002/0003; 165 erakond terms; discipline
   **21024/20940/84 -> 23166/23044/122**; non-attached zero-scorers **17 -> 4**; Laneman 335
   (RE, not in faction), Kiik 166 (SDE). The live B app keeps working (views stay
   query-compatible) and refreshes via ISR within ~1h. `photos` not re-run (members untouched).
3. **Delete branches** (Neon deletes are user-gated): the validation branch
   `br-empty-dust-a6abd6s5` (no longer needed) and, once you're confident, the backup
   `br-cool-paper-a6qe3aqm`.
4. **Deploy `apps/web` (B + C) — DONE (2026-06-15).** Live at
   https://parteidistsipliin.vercel.app; member pages render (Laneman shows RE + "ei kuulu
   fraktsiooni" chip + visx timeline). Deploy method + lockfile footguns now documented in
   CLAUDE.md "Deploying the web app" (deploy from `apps/web` with npm; never a partial
   package-lock). A ~1h detour fixing a broken `apps/web/package-lock.json` (a committed
   build-time swc patch had pruned `next`), then **unified the project on pnpm**: `apps/web` is
   now a standalone pnpm app (`apps/web/pnpm-lock.yaml`, `packageManager pnpm@9.12.0`); removed
   the root pnpm-workspace + root pnpm-lock + the npm lockfile, killing the dual-lockfile
   footgun. Redeployed; Vercel build confirmed "Package Manager changed from npm to pnpm".

**Final whole-implementation review (2026-06-15): PASS, one must-fix resolved.** The opus
final reviewer confirmed the scoring views are correct and faithful (four-case truth table,
faction-only line, self-exclusion, erakond-only-no-faction exclusion) and validated. It
caught one real must-fix-before-cutover: the `0003` seed UPDATE still carried the pre-fix
WRONG codes for KE/E200/SDE/I (the column is informational/unused by scoring, but shipped
wrong data) — **fixed** (codes now match `_CODE_TO_PARTY`; added the spec's partial-unique
index; clarified CLAUDE.md; fixed the "aariregister" typo). Verdict: **ready for prod
cutover.**

Recommended follow-ups (non-blocking, not yet done):
- **SQL view regression test** (spec-mandated): a fixture-DB test asserting the four scoring
  cases. Deferred — the repo has no pg-backed test harness (the plan validated via Neon-branch
  SQL instead). Strongly recommended before further metric edits.
- **Cron wiring for `erakond`**: not in `scrape.yml` (nor are `members`/`photos`). Erakond
  data is slow-changing and a daily run would hit äriregister 100+/day — decide manual vs a
  weekly schedule rather than daily.
- Minor: `_refresh_erakond` counts "matched a card but party not parliamentary" in the same
  `unmatched` bucket as "no candidate" (log-only cosmetic).

## Prior status (erakond design)

**v0.2 / erakond reconciliation — DESIGN APPROVED, spec written.**
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

1. **GH Actions `DATABASE_URL` secret — FIXED (2026-06-15).** The earlier cron run
   (27528969102) failed with psycopg `invalid connection option "﻿…channel_binding"` because
   the secret value had a leading **UTF-8 BOM (U+FEFF)** (set from a PowerShell-written file).
   Re-set the secret cleanly via Git Bash (`printf '%s' '<prod pooled conn>' | gh secret set
   DATABASE_URL --repo Antononlahe/parteidistsipliin` — printf avoids the BOM/newline) and
   smoke-tested with a manual `workflow_dispatch`: run **27562584838 succeeded** ("Ingested 0
   votings for 2026-06-14" — 0 is correct, that Sunday had no sittings; the point is it
   connected to prod with no BOM error). The daily 05:00 UTC cron now writes.
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
