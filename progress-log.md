# Progress log

Append-only history of code and data changes. Newest entry at the top.

Entry format:

```
## YYYY-MM-DD — Short title
**What:** one or two sentences describing the change.
**Why:** the reason / driving question / linked decision.
**Touched:** key files or areas.
```

---

## 2026-06-17 — Member page: XV district filter, legible timeline, against-votes list

**What:** Three member-detail improvements (live in prod). (1) **Districts** query in
`getMemberDetail` now joins `riigikogu_terms` and filters to `number = 15`, so a returning
MP's earlier-koosseis valimisringkond is no longer shown as current (Juku-Kalle Raid was
listing both his XII-Riigikogu district and his XV one, unlabeled). Committees were checked —
no cross-term mixing (they carry dates, all XV). (2) **Vote timeline reworked** for
legibility + interactivity: y-domain tightened to the data with % reference labels (so the
~90–100% range is readable instead of a flat slab hugging the top), lighter area; **drag-to-zoom**
a time window with a reset button; an interaction overlay does hover-tooltip + click-to-open
on the nearest mark; clicking opens the bill's eelnõu page on riigikogu.ee. (3) New
**`VotesAgainst`** list below the graph — the member's "against the faction line" votes,
newest first, each linking to its eelnõu page (`https://www.riigikogu.ee/tegevus/eelnoud/
eelnou/<draft_uuid>`, verified 200); accessible/keyboard-navigable (the reliable counterpart
to graph clicks).

**Why:** User feedback — the timeline was a flat unreadable band, two districts showed with
no explanation, and there was no way to jump from a defection to the actual bill/documents.

**How verified:** 39 web vitest tests (added `eelnouUrl`/`againstVotes` cases), typecheck,
lint, i18n parity all green; production build 427/427 against prod DB. Live-verified the
**static** aspects on `/members/juku-kalle-raid`: exactly one district (Mustamäe ja Nõmme),
10 distinct eelnõu links, y-axis 75/88/100%, svg 640×200. The **interactive** bits
(drag-zoom, hover tooltip, click-to-open on the graph) cannot be verified without a browser
(wmux disallowed) — flagged for the user to confirm; the against-list is the verified,
accessible path to the same links.

**Touched:** `apps/web/lib/{queries,member-detail,member-detail.test}.ts`,
`apps/web/components/member/{vote-timeline,votes-against}.tsx`,
`apps/web/app/[locale]/members/[slug]/page.tsx`, `apps/web/messages/{et,en}.json`. Prod deploy.

**Data note:** `riigikogu_terms` holds terms 7–15 (not just 15 as the old CLAUDE.md seed note
implied) — the writer creates rows for every koosseis appearing in members' histories; term
number 15 (id 9) is the current one.

---

## 2026-06-16 — v0.4-A deployed to prod + member vote-timeline visibility fix

**What:** (1) Deployed v0.4-A to production: applied `0007_faction_rollup.sql` to prod via the
`migrate` CLI (additive — two views, no data change; prod was at 0001–0006, 102 members, 49851
`ballot_alignment` rows), then redeployed `apps/web` (`vercel --prod` from `apps/web`). Live-verified
`/{,en/}fraktsioonid`, `/fraktsioonid/ekre` (Ühtsus 98.6% / 9 liiget / roster), `/factions`→307→
`/fraktsioonid`; prod cohesion reconciles (sum counted = 23166). (2) Fixed a separate, pre-existing
prod bug discovered right after: the member-detail **vote timeline ("Hääletuste ajalugu") rendered
blank for every member**.

**Why (root cause):** `@visx/responsive` `ParentSize` (v4) wraps its child in an absolutely-positioned
`overflow:hidden` measurement div that fills an outer `height:100%` div. The timeline's wrapper
(`<div className="mt-3">`) had **no height**, so the percentage height resolved against an auto-height
parent → the outer div had no in-flow content (measurement div is `position:absolute`) → collapsed to
**height 0** → the 200px chart was clipped to nothing. Width measured fine; height was the killer.
Confirmed by reading the installed `ParentSize.js`/`useParentSize.js` source. The feature shipped this
way in v0.2/C, whose interactive browser verification was the one step left as "still to do" — so it
was never caught.

**Fix:** give the wrapper an explicit `TIMELINE_HEIGHT` (kept in sync with the svg height) so the
ParentSize measurement box can't collapse, plus a `TIMELINE_FALLBACK_WIDTH` for the SSR/pre-measure
render so the prerendered chart isn't zero-width before the client ResizeObserver reports the real
width. Verified in both the prerendered HTML and live: svg now **640×200** with **495 mark x-positions
spread across the width** (was `width=0`, all marks collapsed at one x). Not unit-testable (CSS
layout/clip; jsdom doesn't lay out) — verified via rendered output + source-level root-cause analysis.

**Touched:** `apps/web/components/member/vote-timeline.tsx` (commit `7635a44`); prod DB (`0007`);
two Vercel prod deploys.

**Cleanup pending (user-gated):** delete the Neon build-check branch `br-super-night-a6hqytud`.

---

## 2026-06-16 — v0.4-A: Faction rollups (code-complete + branch-verified; deploy pending)

**What:** Built the v0.4-A faction-rollups slice via subagent-driven development (spec/plan
`docs/superpowers/{specs,plans}/2026-06-16-v0.4-a-faction-rollups*`). New migration
**`0007_faction_rollup.sql`** adds two read-only views: `faction_discipline` (aggregates the
`ballot_alignment` matview by `party_id` using the verbatim `member_discipline` predicate — so
**faction cohesion = aggregate faction discipline, no scoring change**) and `faction_attendance`
(over `ballots ⋈ votes ⋈ member_faction_terms`, all votes incl. procedural, `present = choice <>
'absent'`, faction-at-time). New web: pure `lib/factions.ts` (slug/ratio/sort/most-least-loyal,
10 vitest tests), `lib/factions-queries.ts` (`getFactionComparison` + `getFactionDetail`),
components `factions/{faction-card,faction-grid,faction-roster}`, routes
`/[locale]/fraktsioonid` (card grid of the six fraktsioons) + `/[locale]/fraktsioonid/[slug]`
(header metrics + member roster ranked by discipline, most/least-loyal highlighted). Nav link
wired (was a disabled span) + `/factions → /fraktsioonid` redirect; i18n et+en `factions` namespace.
No topic panel (deferred); committee votes are v0.4-B.

**Why:** v0.4 theme (party/faction rollups). Sub-slice A = faction metrics on existing plenary
data; sub-slice B (committee votes) is a separate later slice. Built two-stage-reviewed per task.

**Verified:** 36 web vitest tests + typecheck + `next lint` green; **production build 427/427 static
pages** (incl. `/{et,en}/fraktsioonid` + 12 `/fraktsioonid/[slug]` pages) against Neon branch
`br-super-night-a6hqytud` (project rapid-star-29400137) with `0007` applied via the `migrate` CLI.
Cohesion reconciles end-to-end: the six factions' counted votes sum to 23166 = the global
discipline total. **Bug caught by the build step and fixed (commit 159e29b):** `parties` also holds
non-parliamentary erakonds (seeded by the 0003 äriregister reconciliation) with zero vote data, so
`getFactionComparison` now restricts to actual fraktsioons via `EXISTS member_faction_terms` (6 rows,
not ~13). Final whole-slice review (opus): READY TO SHIP.

**Touched:** `packages/db/migrations/0007_faction_rollup.sql`,
`apps/web/lib/{factions,factions.test,factions-queries}.ts`,
`apps/web/components/factions/{faction-card,faction-grid,faction-roster}.tsx`,
`apps/web/app/[locale]/fraktsioonid/{page,[slug]/page}.tsx`,
`apps/web/components/site-header.tsx`, `apps/web/next.config.ts`,
`apps/web/messages/{et,en}.json`. Commits `5de6b89`..`159e29b`.

**Deploy pending (NOT done):** apply `0007` to prod via `migrate`, then redeploy `apps/web` from
`apps/web` (`vercel --prod`). Prod migration apply + deploy are user-gated. Cleanup pending
(user-gated): delete the Neon build-check branch `br-super-night-a6hqytud`.

---

## 2026-06-16 — v0.3/D2: Topic explorer LIVE + alignment materialized view (0006)

**What:** Deployed D2 to production (https://parteidistsipliin.vercel.app) and resolved a
performance blocker found during the deploy build. The first prod build timed out (>60s/page)
on the ~200 `/teemad/[edid]` pages: per-topic discipline joins the `member_vote_alignment`
**view**, which recomputes party-at-time for all ~50k ballots via correlated subqueries (~9s,
measured via EXPLAIN ANALYZE) and can't be filtered by topic. Fix (user-approved): migration
**`0006_alignment_matview.sql`** adds a `ballot_alignment` materialized view (a cache of
`member_vote_alignment`, unique-indexed by `(vote_id, member_id)`), plus `db.refresh_alignment`
called after each ingest (`_scrape_range`/`rebuild`/`members`/`erakond`) and a new `migrate`
CLI command (apply migrations without a full rebuild). Topic queries repointed to the matview.
**The discipline definition is unchanged — the matview only caches the existing view.**

**Validated on Neon branch `br-sweet-surf-a6p1kiln`:** the topic-detail query dropped **9027ms
→ 18ms** (~500×). Applied `0006` to prod via `migrate` (matview = 49851 rows, exactly matching
the view; migration recorded). Redeployed: build **READY**, topic pages prerendered. Live
checks: `/` + `/en` 200, `/teemad` 200, `/teemad/5052` 200 (title + ranking table + bills all
render), `/en/teemad` 200, `/topics` → 307 → `/teemad`. Estonian-first routing live (`/` is
Estonian; `/et/...` now redirects to unprefixed). Scraper ruff + 64 tests, web typecheck + 26
tests all green.

**Why:** Ship D2 (the v0.3 topic explorer). The matview is the correct fix for the view's
per-ballot cost and also leaves room to speed the homepage/member pages later.

**Touched:** `packages/db/migrations/0006_alignment_matview.sql`,
`apps/scraper/src/parteidistsipliin_scraper/{db,cli}.py`, `apps/web/lib/topics-queries.ts`,
prod DB (`0006` + `ballot_alignment`), Vercel prod deploy. Commit `cca6c8c` (+ the D2 UI
commits below).

**Cleanup pending (user-gated):** delete the validation branch `br-sweet-surf-a6p1kiln`. The
daily cron (`daily`) now refreshes the matview automatically; `migrate` is reusable for future
migrations.

---

## 2026-06-16 — v0.3/D2: Topic explorer UI (code-complete, locally verified; deploy pending)

**What:** Built the dedicated, removable `/teemad` topic explorer over D1's `vote_topics` view, via
subagent-driven development (spec `docs/superpowers/specs/2026-06-16-v0.3-d2-topic-explorer-design.md`,
plan alongside). Shipped: (1) **Estonian-first routing** — `i18n/routing.ts` now `localePrefix:
"as-needed"` + `localeDetection: false`, so `/` is always Estonian and English is opt-in at `/en/...`;
(2) a `topics` i18n namespace (et+en) + nav links; (3) `lib/topics.ts` pure helpers (thresholds
`INDEX_MIN_VOTES=5`/`MEMBER_MIN_VOTES=3`, `topicLabel` with et-fallback, `disciplineScore`,
`splitByThreshold`) with 8 vitest tests; (4) `lib/topics-queries.ts` read queries (`getTopicIndex`/
`getTopicDetail`/`getTopicBills`) — **no migration, no scoring-SQL change**, discipline expression
copied verbatim from `queries.ts`; (5) `components/topics/` (search index list, per-member discipline
table, bills list); (6) the `/teemad` + `/teemad/[edid]` routes (ISR 3600, `generateStaticParams` over
the ~101 ≥5-vote topics, `dynamicParams`) + a `/topics → /teemad` redirect.

**Design realities confirmed live:** descriptor is the browsable unit (only complete level); top
descriptors are narrower Eurovoc terms with **null English label and null field**, so `topicLabel`
falls back to Estonian and the field chip/breadcrumb shows a "no broad field" note — intended, honest.
The three queries were run against prod (read-only) and return correct data (e.g. `riigieelarve` edid
5052 → 46 votes, 7 bills; 2026 budget draft 737 → 36 votes / 8 defections).

**Verified locally:** typecheck clean, `next lint` clean, **26/26 web vitest tests** pass, both message
files valid + key-parity, production build **compiles successfully**. A whole-surface review (opus)
passed spec compliance with no critical/important issues; three minor nits fixed (coverageNote now
reports the topics-shown count instead of over-counting per-descriptor votes; dropped a redundant
`getLocale()`; removed two unused message keys). One implementation refinement vs the plan: queries
were split into `lib/topics-queries.ts` so the tested pure `lib/topics.ts` never imports `db` (which
throws without `DATABASE_URL` at test load).

**Why:** v0.3/D2 — the user-facing payoff of D1's Eurovoc data. Kept isolated/removable per user
request (Eurovoc sits far from the core metric): removing D2 = delete the `teemad` route folder,
`components/topics/`, `lib/topics(-queries).ts`, the `topics` namespace, the redirect, and revert two
nav lines. The locale change is the one deliberately site-wide piece.

**Touched:** `apps/web/i18n/routing.ts`, `apps/web/next.config.ts`, `apps/web/components/site-header.tsx`,
`apps/web/messages/{et,en}.json`, `apps/web/lib/topics.ts` (+ `.test.ts`), `apps/web/lib/topics-queries.ts`,
`apps/web/components/topics/*`, `apps/web/app/[locale]/teemad/{page.tsx,[edid]/page.tsx}`. Commits
`2c54b4a`, `3973cfe`, `46d4309`, `5e7889f`, `b787d9a`, `e277ba2`, `18decf0`.

**Remaining (user-gated):** the production prerender build + interactive browser check need
`DATABASE_URL` (prod read, classifier-gated) — fold into deploy; deploy `apps/web` per CLAUDE.md. The
Estonian-first routing means existing `/et/...` links will start redirecting to unprefixed (expected).

---

## 2026-06-16 — v0.3/D1: Eurovoc ingestion PROD CUTOVER (live)

**What:** Validated D1 on Neon branch `br-restless-river-a696s26g` then cut over to prod
(additive: applied `0005`, ran `eurovoc` offline from the committed cache). Prod now has the
Eurovoc taxonomy + bill→topic links: **21 fields, 127 microthesauruses, 1043 descriptors,
233/233 bills linked, 1052 topic links, 1828 `vote_topics` rows, 0 orphan links, discipline
counted 23166 — unchanged**. Captured 3 committed fixtures + a real-shape regression test (64
offline tests total). Committed the taxonomy+drafts raw cache (256 + 233 files) for offline
`rebuild`.

**Two issues handled during the live run:** (1) **Bug** — `_refresh_eurovoc` held an idle Neon
connection through the ~4-min taxonomy fetch; the serverless pooler dropped it ("SSL connection
has been closed unexpectedly") so the first write failed. Fixed: fetch taxonomy into the cache
holding no connection, open the DB only for the write + interleaved draft phases. (2) **Coverage
finding (root-caused, decided ship-as-is)** — broad-**field** rollup resolves for only 88/233
bills (38%) because Eurovoc is hierarchical and bills cite **narrower** descriptors the
`/api/eurovoc/microthes` endpoint omits, with empty `hierPaths`/`broaderTerms`/`microThesauruses`
ancestry. Descriptor-level filtering is 100% complete; field-level faceting is partial. A
recursive `narrowTerms` crawl to lift field coverage is deferred (own slice).

**Why:** Roadmap governing decision 3 — official Eurovoc tags. D1 lands the data + `vote_topics`
foundation; D2 (topic UI) is now purely additive.

**Touched:** `apps/scraper/src/parteidistsipliin_scraper/cli.py` (connection-order fix),
`apps/scraper/tests/test_eurovoc_fixtures.py`, `apps/scraper/fixtures/api/eurovoc/`,
`apps/scraper/cache/api/{eurovoc,drafts}/`, prod DB (`0005` + eurovoc tables), `CLAUDE.md`,
`progress.md`.

---

## 2026-06-16 — v0.3/D1: Eurovoc ingestion code complete (offline)

**What:** Implemented Tasks 1–5 of the D1 plan via subagent-driven development. Migration
`0005_eurovoc.sql` adds `eurovoc_fields`/`eurovoc_microthesauri`/`eurovoc_descriptors`/
`volume_topics` + the `vote_topics` view; `db.py` gains the matching upserts +
`distinct_draft_uuids`. New `eurovoc_models.py` (pure mappers, unit-tested) and
`eurovoc_cache.py` (git-committed raw-JSON archive, unit-tested). `writer.py` gains
`write_eurovoc_taxonomy` + `write_volume_topics` (a bill descriptor missing from the taxonomy is
inserted from the draft's `{edid,text}` so no link is dropped); `cli.py` gains the `eurovoc`
command (taxonomy fields+microthes et+en → per-`draft_uuid` `/api/volumes/drafts/{uuid}`
descriptors → `volume_topics`) and a `rebuild` replay of the eurovoc+draft caches. Also synced
`apps/scraper/uv.lock` to the already-declared `beautifulsoup4` dep (separate chore commit).
Verified offline: 61 tests pass, `import parteidistsipliin_scraper.cli` clean, ruff clean.
Additive only — no discipline change.

**Why:** Roadmap governing decision 3 — topic categorization uses official Eurovoc tags. D1
lands the data + `vote_topics` foundation so D2 (topic UI) is purely additive.

**Touched:** `packages/db/migrations/0005_eurovoc.sql`, `apps/scraper/src/parteidistsipliin_scraper/{db,eurovoc_models,eurovoc_cache,writer,cli}.py`, `apps/scraper/tests/test_eurovoc_{models,cache}.py`, `apps/scraper/uv.lock`. Commits `3cc9753`, models/cache commits, `e452bee`.

**Remaining (Task 6, user-gated):** fixtures, live `eurovoc` run, Neon-branch reconciliation
SQL, prod cutover, commit cache, docs.

---

## 2026-06-15 — v0.2: erakond reconciliation PROD CUTOVER (live)

**What:** Applied the erakond reconciliation to production (with explicit user permission;
prod destructive writes are normally classifier-gated). Chose a **minimal, non-destructive**
cutover rather than the A1/A2 wipe-and-rebuild, because `0003` only renames
`member_party_terms` -> `member_faction_terms` (data preserved), adds `member_erakond_terms`
+ `parties.registry_code`, and reworks the views — none of which requires rebuilding the
existing votes/ballots/faction-terms. Steps: (1) created backup branch
`pre-erakond-cutover-backup` (`br-cool-paper-a6qe3aqm`) as a restore point; (2) applied
`0003` to prod via `db.apply_migrations` (recorded 0003); (3) ran `parteidistsipliin-scraper
erakond` against prod — fully offline from the committed gzip ariregister cache, matched
96/101. `photos` not re-run (members untouched).
**Result (prod, SQL-verified):** schema_migrations 0001/0002/0003; `member_faction_terms`
present; 165 erakond terms across 96 members; discipline **21024/20940/84 -> 23166/23044/122**;
non-attached zero-scorers **17 -> 4** (Valge/Grünthal/Kunnas/Mölder, correctly excluded);
Laneman 335 (RE, in_faction=false), Kiik 166 (SDE). The deployed B app keeps querying fine
(reworked views are column-compatible) and refreshes via ISR within ~1h.
**Why:** ship the ~17% of members previously missing from the core metric.
**Open:** redeploy `apps/web` for B+C (prod schema now supports C); delete the validation +
backup branches when confident; the GH Actions `DATABASE_URL` BOM secret still needs fixing
for the daily cron (parked).

---

## 2026-06-15 — bugfix: members snapshot was wiping votings-derived faction (32 members)

**What:** Reported as "Kalev Stoicescu shows no party". Systematic debugging found a much
broader bug: `_current_faction_name` returned the FIRST `active` faction from the
`/api/plenary-members` `factions[]` array, but that array lists every faction a member ever
held, oldest-first, ALL flagged `active`, with no dates. For 32 substitute members who first
entered non-attached then joined a fraktsioon (first entry "Fraktsiooni mittekuuluvad"),
`write_member` mapped that to non-attached and **wiped their real votings-derived faction**
(Stoicescu/Hussar→E200, Timpson/Kadastik→RE, ... across all parties) → they rendered "no
party". The snapshot is unusable for current faction (no first/last rule works — e.g. Kiik's
is `[mittekuuluvad, KE, mittekuuluvad]` and he genuinely IS non-attached). Per CLAUDE.md the
per-ballot `voters[].faction` is the source of truth.
**Fix:** `write_member` no longer sets faction at all (removed the faction block, the
`set_faction`/`today` params, and the dead `_current_faction_name`); faction comes solely
from `write_voting`. Restored the 32 on prod (deleted the non-attached terms opened today,
reopened the party terms closed today) and redeployed. **Discipline unaffected** (vote-time
terms already covered the votes — totals stay 23166/23044/122); 84 in-faction, 4 genuinely
no-party, 1 former (Solman, restored earlier). Verified live (Stoicescu/Hussar = E200, etc.).
**Note (separate, not fixed — no current visible impact):** the äriregister erakond match is
by exact name+DOB, so a genuinely non-attached member whose registered name differs (e.g.
"Grigore-Kalev Stoicescu" vs "Kalev Stoicescu") won't match. Irrelevant for Stoicescu (he's
in the E200 fraktsioon, so faction-first wins). A name-tolerant match is a future enhancement.
**Touched:** `apps/scraper/.../{writer,cli}.py` (54 tests pass, ruff clean). Prod faction
terms restored via SQL; redeployed.

---

## 2026-06-15 — v0.2: active members + cycle label (live)

**What:** Distinguished currently-sitting members from those who voted this term but are no
longer active. Migration `0004` adds `members.active`. The `members` command (and offline
`rebuild`) now reconciles: list members (`/api/plenary-members`, 101) are written `active=true`;
members present in the DB but absent from the list (voted via votings, but dropped from the
active list — only **Riina Solman**, who is `active:false` in the API) are fetched from the
per-member endpoint `/api/plenary-members/{uuid}`, enriched, and written `active=false`; the
extra records are archived to `cache/api/plenary-members-extra.json` for offline rebuild. Web:
inactive rows are muted + tagged `endine` in the still-single ranked list; the detail page
shows a muted "Oli XV Riigikogu liige · ei ole enam aktiivne" note + de-emphasis; a static
`XV Riigikogu · 2023–` cycle label on list + detail. Built subagent-driven (scraper group +
web group, each reviewed).
**Cutover (prod, with user permission):** applied `0004`; ran `members` → "101 active + 1
former"; verified active 101 / former 1 (Solman), her DOB (1972-06-23) + email now populated,
discipline unchanged (23166); committed the extras cache; redeployed.
**Follow-up fix found in the eyeball:** running `members` had wiped Solman's Isamaa faction to
non-attached (her individual API record has empty `factions` — the API clears them on
inactivity), so her badge regressed to "Fraktsioonitu". Added `write_member(set_faction=False)`
for the gap/former loops (a cleared record no longer wipes a former member's faction) and
restored her Isamaa term on prod; she now shows **Isamaa (greyed) + former note**. Discipline
unaffected throughout.
**Why:** members who served this cycle but stepped down (ministers, resignations) were sparse
and undistinguished; this is the within-cycle slice of the broader election-cycle roadmap
(multi-cycle grouping + historical backfill remain v1.0; all-time stats post-1.0).
**Touched:** `packages/db/migrations/0004_active.sql`; `apps/scraper/.../{db,api_cache,writer,
cli}.py` (+ test, cache); `apps/web/lib/queries.ts`, `components/members-table.tsx`,
`components/member/member-header.tsx`, `app/[locale]/{page,members/[slug]/page}.tsx`,
`messages/{et,en}.json`. Spec/plan under `docs/superpowers/`.

---

## 2026-06-15 — v0.2/C: member-detail page (code complete + build-validated)

**What:** Built the per-member detail page via subagent-driven development. Route
`app/[locale]/members/[slug]/page.tsx` (ISR `revalidate=3600`, `generateStaticParams` over
all slugs, View Transition from the list, `notFound` on unknown slug). `getMemberDetail(slug)`
in `lib/queries.ts` returns the member record + scoring party + `in_faction`, discipline
summary, a **per-party-at-time breakdown** (`member_vote_alignment` grouped by scoring
`party_id`), the ~600-row per-vote series, and committees/districts. Pure tested
`lib/member-detail.ts` (`classifyVote`, `monthlyDiscipline`, `partySwitchPoints` — 9 vitest
tests). Components under `components/member/`: `member-header` (with the "party member · not
in faction" chip driven by `in_faction`), `discipline-summary`, `party-breakdown`,
`affiliations-panel`, and the **visx** `vote-timeline` (monthly trend `AreaClosed`/`LinePath`
+ per-vote strip + dashed party-switch guides + `@visx/tooltip` + keyboard-focusable marks).
Members-table names link into the page. i18n `memberDetail` namespace (et + en).
**Why:** v0.2/C — the first per-member story, and where the erakond "not in a faction"
distinction becomes visible (roadmap requirement).
**Verification:** 18 vitest tests pass; tsc + `next lint` clean; **production build generated
209/209 static pages**, all ~204 member pages (102 × 2 locales) prerendered against live
branch data with the timeline server-rendered, 0 `MISSING_MESSAGE`; member-page bundle
30.4 kB / 199 kB First Load. The build caught a real bug — pg returns DATE/TIMESTAMP as JS
`Date` while the row types/components treat them as strings (`.slice()`); fixed with `::text`
casts in the query. Interactive checks (timeline hover/keyboard, View Transition, responsive)
need a live deploy, as with B.
**Touched:** `apps/web/` — `app/[locale]/members/[slug]/page.tsx`, `components/member/*`,
`lib/{member-detail,queries}.ts` (+ test), `components/members-table.tsx`, `messages/{et,en}.json`,
`package.json` (visx). Plan/spec under `docs/superpowers/`.

---

## 2026-06-15 — v0.2: erakond reconciliation implemented + branch-validated

**What:** Executed the erakond/fraktsioon plan via subagent-driven development (fresh
implementer + spec + quality review per task). Landed: `ariregister_models` (Candidate/
Membership/PartyTerm, registry-code + party-name resolvers, name+DOB matcher),
`ariregister_parse` (card-based search + tr-based history, markup-tolerant), polite async
`ariregister_client`, git-committed `ariregister_cache`, migration `0003_erakond.sql`
(rename `member_party_terms`->`member_faction_terms`, add `member_erakond_terms`,
`parties.registry_code`, reworked discipline views: scoring party = faction-first then
erakond-fallback, party line = faction members only, self-excluded only when in-faction),
db/writer/CLI wiring (`erakond` command + offline `rebuild` replay), and web `in_faction`.
**Branch validation (Neon `br-empty-dust-a6abd6s5`) caught two bugs, both fixed:**
1. **Wrong registration codes.** Seeded KE/E200/SDE/I codes were wrong, so those memberships
   created duplicate name-keyed party rows with no Riigikogu faction -> party-line join
   failed -> non-attached members in those parties (Kiik, Aab, Põlluaas, Hanimägi, Karuse,
   Karilaid, Ernits, Izmailova) scored 0. Corrected codes from live registry
   (KE 80053370, E200 80551335, SDE 80052459, I 80243584; RE/EKRE were already right) and
   added `_NAME_TO_PARTY` + `name_to_party` as a second resolver (also consolidates Isamaa
   name variants).
2. **No history link for single-membership members.** The registry only renders a "Liikme
   ajalugu" link for people with a multi-party history; members with one stable membership
   (Eesmaa, Sarapuu) had no link, so the search parser skipped them. The parser now emits
   card-only candidates (person_id None) carrying the current-party name; `match_candidate`
   accepts them; `card_to_party_term` builds one open term from the card; the importer uses
   it when there is no history link.
**Result (branch, SQL-verified):** matched 96/101; non-attached zero-scorers 17 -> 4 (Valge
= non-parliamentary ERK, Grünthal/Mölder = membership ended/no current party, Kunnas = not in
registry — all correctly excluded); faction-member scores unchanged; discipline totals
21024/20940/84 -> 23166/23044/122. 53 offline tests pass, ruff clean.
**Why:** ~17% of members were missing from the core metric; party (erakond) is the right
unit, and the registry is the only erakond source.
**Touched:** `apps/scraper/src/parteidistsipliin_scraper/{ariregister_*,db,writer,cli}.py`,
`apps/scraper/tests/test_ariregister_*`, `packages/db/migrations/0003_erakond.sql`,
`apps/web/lib/queries.ts`, fixtures under `apps/scraper/fixtures/ariregister/`.
**Open:** äriregister cache persistence (~31MB raw HTML — decide raw/gzip/distill before
committing; offline rebuild needs it); prod cutover (user-gated); delete validation branch.

---

## 2026-06-15 — v0.2: erakond ↔ fraktsioon reconciliation (root-caused + spec)

**What:** Triaged a reported data bug — "Alar Laneman shows 0 votes" on the live site —
through systematic debugging. Root cause: the Riigikogu API carries only **fraktsioon**
(parliamentary faction) membership, never **erakond** (party) membership (confirmed: no party
field on any member-record key; all 597 of Laneman's ballots carry
`Fraktsiooni mittekuuluvad Riigikogu liikmed`). 17 of 102 members are non-attached for the
whole window → `party_id = NULL` → excluded from discipline → 0 counted votes. Per the
official party registry, Laneman is Eesti Reformierakond since 2024-07-12 (ex-EKRE). Not a
porting bug — the API lacks the fact. Investigated sources: Riigikogu API (no erakond),
äriregister open-data API (companies only, no bulk party-members file), äriregister
party-registry **web UI** (server-rendered HTML, searchable by name, dated history keyed on a
RIK person id — verified end-to-end for Laneman). Designed a fix and wrote the spec:
introduce the äriregister registry as a second ingestion source matched by name+DOB; split
`member_party_terms` → `member_faction_terms` and add `member_erakond_terms`; rework the
discipline views so the scoring party is fraktsioon-first / erakond-fallback and the party
line is defined by faction members only. Approach approved via brainstorming; spec under
user review before writing-plans.
**Why:** ~17% of members were silently missing from the core metric; party-line loyalty is
the whole point of the dashboard, and party (erakond) is the right unit, not faction.
**Touched:** `docs/superpowers/specs/2026-06-15-v0.2-erakond-fraktsioon-reconciliation-design.md`
(new), `progress.md`, `progress-log.md`. No code yet (gated on spec review).

---

## 2026-06-15 — v0.2/B: deployed and signed off

**What:** Deployed `apps/web` with the B design-system foundation and live-verified it
against real data — theme toggle, row motion, responsive widths, and the populated members
table all confirmed by the user. B is done; v0.2/C (member-detail page) is now the active
slice.
**Why:** Closes the one gap that the sandbox could not exercise (no reachable DB), moving B
from "code complete" to "done."
**Touched:** deploy only (no code change); `progress.md` updated to make C current.

---

## 2026-06-15 — v0.2/B: design-system foundation + members table (code complete)

**What:** Stood up the editorial design-system foundation in `apps/web` and rebuilt the
members list against it. Token layer (`globals.css`) as CSS variables with light + dark
themes, mapped to Tailwind v4 via `@theme inline`; the locked six-party palette (RE/EKRE/
KE/E200/SDE/I) as fill + ink tokens (dark tones lifted for AA). Added shadcn/ui (button,
dropdown-menu, new-york), next-themes (class strategy + system default), self-hosted fonts
(Source Serif 4 display + Inter UI via `next/font`), Framer Motion (row-reorder, reduced-
motion aware), and CSS `@view-transition`. New components: party badge, discipline bar,
member avatar (photo + initials fallback), theme + locale toggles, editorial site header,
and the client `MembersTable` (sortable by name/discipline/votes/against, party filter,
`aria-sort`). Pure logic unit-tested: `lib/party.ts` (token mapping) and `lib/members.ts`
(sort with nulls-last + Estonian collation, filter) — 9 vitest tests. Query extended with
`photoThumbPath`. Visual direction (editorial/broadsheet), dark-mode-now, enriched-table,
and palette were chosen via a brainstorming session with browser mockups.
**Why:** Governing decision 4 — "UI is first-class from v0.2." B is the design layer every
later version builds against (additive, not a re-skin). Member-detail page (visx vote
timeline, party-switch lines) is deliberately deferred to slice C.
**Bug fixed mid-integration:** `NextIntlClientProvider` was rendered without `messages`;
on next-intl v3 (no v4 auto-inheritance) this made client `useTranslations` (theme/locale/
table/filter namespaces) throw `MISSING_MESSAGE` once client islands rendered. Fixed by
`getMessages()` in the layout and passing `messages={messages}` (commit `616931e`).
**Verification:** typecheck, `next lint`, and 9 vitest tests all clean; production build
compiles, generates 5/5 static pages, 0 `MISSING_MESSAGE`; dev server returns HTTP 200 with
the editorial shell. Interactive checks (theme toggle, motion, responsive widths) and the
real-data table need a reachable DB and are left for manual confirmation (no DB in sandbox).
**Touched:** `apps/web/` — `app/[locale]/{globals.css,layout.tsx,page.tsx}`,
`components/` (ui/ + site-header, theme/locale toggles, party-badge, discipline-bar,
member-avatar, members-table, theme-provider), `lib/{party,members,queries,utils}.ts`
(+ tests), `components.json`, `package.json`. Spec + plan under `docs/superpowers/`.
Executed via subagent-driven development (per-task implement + spec review + quality
review).

---

## 2026-06-15 — v0.2/A2: production cutover (validated, live)

**What:** Applied A2 to production. Validated first on an isolated Neon branch
(`a2-structure`, since deleted): `apply_migrations` -> `members` -> clean `rebuild` ->
`photos`. Then applied in place exactly as A1 did — apply 0002, TRUNCATE the writer-managed
tables, `rebuild` from the committed cache, `photos`. Committed the validated artifacts
(`cache/api/sessions.json`, 101 WebP thumbnails under `apps/web/public/members/`).
**Result (production, verified by SQL):** 598 votes / 51926 ballots / 102 members
(unchanged); **discipline 21024 / 20940 / 84 — byte-identical to pre-migration**; 150
sittings (0 unmapped), 176 sessions, 15 committees / 295 committee terms, 13 districts /
234 district terms, 395 votes with a draft, 101 enriched members, 101 thumbnail paths.
**Why TRUNCATE+rebuild:** `rebuild` reconstructs `member_party_terms` chronologically from
an empty slate; layering it onto existing terms re-dates them and violates the
`ended_on >= started_on` check (caught on the branch when running `members` before
`rebuild`). The clean wipe-and-rebuild reproduces identical scoring — the cache is the
source of truth.
**Bug fixed mid-validation:** `apply_migrations` recorded versions into `schema_migrations`
before the migration that creates the table could run on a 0001-only DB; now it creates the
tracking table up front (commit `9c7e355`).
**Follow-ups (minor, logged in progress.md):** NULL-`started_on` dedupe on
`member_committee_terms`; `photos` single-transaction failure mode.
**Touched:** production DB (Neon `rapid-star-29400137`); `cache/api/sessions.json`,
`apps/web/public/members/*.webp`, `progress.md`.

---

## 2026-06-14 — v0.2/A2: structural schema + member enrichment (code complete)

**What:** Migration `0002_structure.sql` adds `schema_migrations` (+ a `db.apply_migrations()`
runner that `rebuild` invokes), `riigikogu_terms`, `sessions`, `sittings`, `committees` +
`member_committee_terms`, `electoral_districts` + `member_district_terms`, and enrichment
columns on `members` (birth/death/gender/email/phone/seniority/mandate/photo_*) and `votes`
(`sitting_id`, `draft_uuid/title/mark`). New modules: `enrich.py` (pure transforms —
sitting->session date map with overlap tiebreak, committee/district terms, member fields)
and `photo.py` (WebP thumbnails written to `apps/web/public/members/<uuid>.webp`). Extended
`api_models` (Session/Committee/DistrictHistory/Sitting/RelatedDraft + member bio + Voting
sitting/draft), `api_cache` (sessions.json archive), `api_client` (`get_bytes`), `writer`
(now a `WriteContext`; sessions/sittings/committees/districts/enrichment/vote-links), and
`cli` (sessions fetch, offline-complete `rebuild`, new `photos` command). The party-term /
ballot / vote-row path is byte-for-byte unchanged, so discipline scores do not move.
**Why:** v0.2 governing decision 2 — lay the structural schema down now so later UI is
additive, not migratory. Almost all of it is reproducible offline from A1's committed cache;
only `/api/sessions` and the photo binaries need a one-time live fetch (then archived).
**How verified:** 11 plan tasks, each implemented by a fresh subagent and passed through
two-stage (spec + code-quality) review. 27 offline tests pass, ruff clean. Live DB
validation (Task 11 — discipline parity + structure counts against a Neon branch, then
production) is the remaining step.
**Touched:** `packages/db/migrations/0002_structure.sql`; `apps/scraper/src/parteidistsipliin_scraper/`
(`api_models`, `api_cache`, `api_client`, `db`, `writer`, `enrich`, `photo`, `cli`);
fixtures + tests; `apps/scraper/pyproject.toml` (+ pillow); `CLAUDE.md`, `progress.md`.

---

## 2026-06-14 — Ops: set GH Actions `DATABASE_URL` secret (closes v0.1 open item)

**What:** Set the `DATABASE_URL` Actions repo secret on `Antononlahe/parteidistsipliin`
via `gh secret set --app actions` (gh 2.94.0 at `C:\Program Files\GitHub CLI\gh.exe`),
value = the validated Neon pooled connection string from `apps/scraper/.env`. The daily
cron (`scrape.yml`) now has a write path. Not yet exercised by a manual dispatch — a
`workflow_dispatch` is a live production write and was left for the user / the 05:00 UTC
cron.
**Why:** Last open v0.1 blocker — the API-sourced daily cron couldn't write without it.
**Touched:** GitHub repo Actions secrets (no code change); `progress.md` follow-ups.

---

## 2026-06-14 — v0.2/A1: API ingestion cutover (HTML removed); parity-verified

**What:** Replaced HTML scraping with the official Open Data API (`api.riigikogu.ee`) as
the sole ingestion source, API-native. New modules: `api_client` (async, hard 1 req/s,
429/5xx backoff), `api_models` (pydantic mirroring the API JSON), `api_parse`
(`vote_type_slug` relocated from the old `title_to_slug`, plus a `decision.code`->choice
map), `api_cache` (git-committed raw-JSON archive under `cache/api/`, offline `rebuild`),
and `writer` (maps `Voting`/`PlenaryMember` into the unchanged v0.1 schema, preserving the
party-term transition logic). `db.py` signatures decoupled from model classes; `models.py`
trimmed to `Choice` + faction helpers; `cli.py` rewired to `backfill`/`daily`/`rebuild`/
`members` over the API. Removed: `parsers/*`, `client.py`, distilled `cache.py`, the HTML
fixtures/tests, and the old `cache/votes.jsonl`/`members.json`. Dropped the now-unused
`selectolax` dependency; pointed `scrape.yml` at `RIIGIKOGU_API_BASE`. 10 offline tests
green, ruff clean.

**Parity (post-port, validation not a gate):** captured the pre-cutover HTML-derived
per-member discipline as a baseline, re-ingested the 1-year window via the API into a Neon
branch, and diffed. Vote count identical (598). Totals moved counted 20948->21024,
aligned 20868->20940, defections 80->84. Every difference traces to one cause: the API
captures **Riina Solman** (Isamaa, exactly 221 ballots — the entire ballot delta) whom the
HTML scrape had missed; her inclusion changes the Isamaa party-line denominator for a
handful of votes, shifting her 6 Isamaa colleagues by +-1-2. No other faction affected, no
porting bug. Judged a data improvement; cut over.

**Cutover:** wiped production and rebuilt offline from the committed `cache/api/` archive,
then refreshed members. Production now 598 votes / 51926 ballots / 102 members, discipline
counted 21024 / aligned 20940 / defections 84. Parity branch deleted.

**Why:** Roadmap governing decision 1 (migrate ingestion to the API). Decided this session
to go API-native and discard HTML outright (only reintroduce a parser for a real API gap).

**Touched:** `apps/scraper/src/parteidistsipliin_scraper/{api_client,api_models,api_parse,
api_cache,writer,db,models,cli}.py`, `fixtures/api/*`, `tests/test_api_*`,
`cache/api/votings.jsonl`, `pyproject.toml`, `.github/workflows/scrape.yml`, `CLAUDE.md`,
`progress.md`, this log. Specs/plans under `docs/superpowers/{specs,plans}/`.

**Still open:** GH Actions `DATABASE_URL` secret unset (gh CLI absent — manual step);
apps/web redeploy to surface new data immediately (ISR refreshes within 1h regardless).

---

## 2026-06-14 — Comprehensive roadmap to v1.0+ approved; ingestion to move to the official API

**What:** Researched the full breadth of Riigikogu's published data and approved an
expanded roadmap (`~/.claude/plans/can-you-go-over-crystalline-beacon.md`). Key finding:
an official Open Data REST API at `api.riigikogu.ee` (JSON, stable UUIDs, CC-BY-SA,
**1 req/sec**, spec `/v3/api-docs`) exposes everything we scrape plus members' full bios,
committees, Riigikogu terms, speeches/stenograms, bills with sponsors, interpellations,
written questions, EU documents, a Eurovoc subject taxonomy, seating plans, events, and
pre-computed voting/speech/participation statistics.

**Decisions:** (1) migrate ingestion from HTML scraping to the API (HTML parsers kept as
fallback); (2) lay down schema now for four domains — votes, speeches, bills, oversight;
(3) topic categorization via official Eurovoc tags, not manual rules/LLM; (4) UI is
first-class from v0.2 — design system + Recharts/visx charts + Framer Motion / Next.js
View Transitions on the existing Next.js/Tailwind base, proposing shadcn/ui.

**Why:** The user wants every feature enumerated up front so the data model isn't torn up
later as scope grows toward a generic "MP activity profiler." The API makes most of that
data cheap to ingest cleanly.

**Touched:** `progress.md` (roadmap section replaces old backlog), this log. No code yet;
v0.2 implementation (API client + schema migration `0002_*` + design system) is the next
slice. CLAUDE.md scope ladder still shows the old table — reconcile at v0.2 kickoff.

---

## 2026-06-14 — Party-transition tracking + cleanups; rebuild on 1-year dataset (commit 39b0ab9)

**What:** Fixed a party-history bug and did the three deferred cleanups, then rebuilt
the data on a deliberately smaller (1-year) window.

**Bug:** every member had a single never-closed `member_party_terms` row — party
movements within the term were invisible (e.g. Züleyxa Izmailova still showed as
Eesti 200 after going non-attached; her term opened 2023-05-23, `ended_on` NULL). Cause:
the writer only updated terms when a ballot had a party, so a member leaving a
fraktsioon (→ non-attached, party None) never closed their old term. Fix: resolve each
ballot's faction to a party id (None = non-attached) and record any change, including
party ↔ non-attached, closing the old term and opening a NULL-party term.

**Cleanups:** (1) `faction_to_party()` maps fraktsioon names to the seeded
abbreviations RE/EKRE/KE/E200/SDE/I, so `parties` reuses the seed rows and the table
shows abbreviations; (2) fixed the `members` command URL to
`/riigikogu/koosseis/riigikogu-liikmed/`; (3) reconciled CLAUDE.md + the migration
comment (slug is title-derived; member key is the saadik UUID; non-attached modeling).

**Scope decision:** per the user, develop against a **1-year dataset** (backfill
`--from 2025-06-14`) and keep iterating on the smaller set until v1.0, rather than the
full 3-year term. Wiped the full-term data (TRUNCATE; user-authorized) keeping the 6
seed parties, and re-backfilled 1 year with the fixed logic. A `members` refresh +
redeploy follow.

**Gate:** ruff clean, 30 parser tests pass.

**Touched:** `apps/scraper/src/.../{cli,models}.py`,
`apps/scraper/tests/test_parsers.py`, `CLAUDE.md`,
`packages/db/migrations/0001_initial.sql`. Neon data (wiped + 1-year re-backfill).

---

## 2026-06-14 — Full-term backfill complete; fixed stale static render

**What:** The background backfill finished: 2,157 new votes (2,187 total) across the
full 15th term (2023-04-10 → 2026-06-11), 173,147 ballots, all 101 members, 607
procedural votes excluded, 100 scored. Full-term discipline spreads sensibly — e.g.
Alar Laneman (EKRE) 41% over 901 counted votes, Züleyxa Izmailova (E200) 35%,
independents excluded.

**Issue found + fixed:** the live site was showing stale numbers (452 max counted / 19
distinct scores vs the DB's 982 / 38). The dashboard page is statically generated
(`export const revalidate = 3600`), and the first deploy rendered it mid-backfill. No
code change needed — a `vercel deploy --prod` after the backfill rebuilt the baseline,
and the live `/et` now matches the DB (982 max / 38 scores; Laneman/Izmailova present).
ISR (1h) + the daily cron will keep it current automatically.

**Touched:** Neon data (full backfill), Vercel (redeploy), `progress.md`.

---

## 2026-06-14 — Deployed v0.1 to Vercel (live on both locales)

**What:** Linked and deployed the Next.js app to Vercel. Project
`parteidistsipliin` (`prj_j111iI8XkWuKyYH9FYrFOmVGlYKI`, team
`anton-111-projects`/`team_24n825QuH1xBt8LxjQLFQoR8`), linked from `apps/web` so
Vercel auto-detected Next.js. Set `DATABASE_URL` (production target) to the Neon
pooled URL via `vercel env add`. `vercel deploy --prod` succeeded.

**Live:** https://parteidistsipliin.vercel.app (alias) — both `/et` and `/en` return
HTTP 200 and render the sortable members table from the `member_discipline` view:
ET headers Nimi/Fraktsioon/Distsipliin/Arvestatud hääletused/Vastu-hääled, EN
Name/Faction/Discipline/Counted votes/Defections, real rows (e.g. Arvo Aller EKRE
63.2%). Counts grow live as the background backfill lands.

**Mechanics learned:** the Vercel MCP `deploy_to_vercel` tool is advisory only (it
returns instructions); the actual deploy needs the `vercel` CLI (installed globally,
v54) authenticated via `vercel login` (user step, separate from the MCP OAuth). The
MCP exposes no env-var or project-settings write tools, so env + root config go through
the CLI.

**Still open for v0.1:** (a) GitHub Actions `DATABASE_URL` secret for the daily scrape
(scrape.yml) — not set, so the cron can't write yet; (b) `DATABASE_URL` for Vercel
`preview` target (the add hit a confirm prompt and only `production` landed);
(c) doc reconciliation in CLAUDE.md (slug is title-derived; member key is the saadik
UUID). `.vercel/` is gitignored.

**Touched:** Vercel project (external), `apps/web/.vercel/` (gitignored), `progress.md`.

---

## 2026-06-14 — First backfill: writer speedup + non-attached fix (commit 46530cd)

**What:** Ran the first real backfill against Neon and fixed two issues it exposed,
then verified discipline on a single day and launched the full 15th-term backfill
(`--from 2023-04-10`) in the background.

1. **Writer was pathologically slow** — `_scrape_into` re-upserted ~101 members +
   parties on every vote (~300 sequential round-trips/vote ≈ 75 s/vote to the
   us-west-2 endpoint from the EU). Added in-process caches (member id, party id,
   current faction) so the DB is touched only on first sighting or a real party
   switch; steady-state ≈ 4 round-trips/vote. The curls were never the bottleneck
   (a 477 KB detail page fetches in ~0.67 s); the chatty writer × distant region was.
2. **Independents scored as a pseudo-party** — members in no fraktsioon are listed
   under "Fraktsiooni mittekuuluvad ...". Treating that as a party made the view score
   each independent against the bloc of all other independents. `normalize_faction()`
   now maps that label to `None`, so they are stored party-less and excluded.

**Verified (single day 11.06.2025, 30 votes):** after deleting the pre-fix pseudo-party
rows (1 party, 17 terms), `member_discipline` scores 76 real party members, 0
independents; "least disciplined" is now Priit Sibul (Isamaa, 0.882),
Helir-Valdor Seeder (0.941), with most Reform members at 1.000 — a sane single-day
cohesion pattern. Choice domain present: yes/no/abstain/absent/neutral.

**Backfill running:** full term in the background; resumable (the `vote_exists` check
skips already-ingested votes). Projected ~1.5-2 h, now dominated by the polite 500 ms
fetch delay rather than the DB.

**Touched:** `apps/scraper/src/.../{cli,models}.py`,
`apps/scraper/src/.../parsers/{vote_detail,members}.py`,
`apps/scraper/tests/test_parsers.py` (14 -> 21 tests). Neon data (deleted pseudo-party).

---

## 2026-06-14 — Provision Neon, apply schema; deploy/backfill in progress

**What:** Created Neon project `parteidistsipliin` (org "Anton", free; project
`rapid-star-29400137`, db `neondb`, pooled `us-west-2` endpoint) and applied
`packages/db/migrations/0001_initial.sql` via the Neon MCP. Verified: 6 tables, 3 views,
6 parties + 2 procedural types seeded, `member_discipline` queryable (0 rows on empty
db). Wrote the pooled `DATABASE_URL` into gitignored `apps/scraper/.env` and started a
local smoke-test backfill (single busy day 11.06.2025) before any full-term run. Vercel
OAuth not yet completed (localhost callback failed on remote session; awaiting the
callback URL).

**Why:** v0.1 next-slice steps 3-5 — first real data into a hosted DB and a deploy.
Backfill is local per the chosen path (fastest feedback; direct view inspection).

**Open follow-ups surfaced:** (1) scraped faction strings are full names
("Eesti Reformierakonna fraktsioon"), so they don't match the seeded RE/EKRE
abbreviations — seed party rows go unused; cosmetic for v0.1. (2) `cli.py members`
fetches `/riigikogu-liikmed/`, but the real path is
`/riigikogu/koosseis/riigikogu-liikmed/` — bug, not on the backfill path. (3) choice
mapping decision to confirm: `Ei hääletanud → neutral`, `Puudub → absent` (does not
affect the score; both are excluded from counted votes).

**Touched:** Neon project (external), `apps/scraper/.env` (gitignored).

---

## 2026-06-14 — Fix scraper parsers against live HTML (commit 1b26513)

**What:** Rewrote the three parsers + listing URL against the captured fixtures; 14
tests pass, ruff clean. Listing now queries `startFrom`/`endTo`; `vote_type_slug` is
derived from the vote **title** (URL slug is always `kohalolekukontroll`), keeping the
procedural lookup intact ("Kohaloleku kontroll"→`kohalolekukontroll`,
"Päevakorra kinnitamine"→`paevakorra-kinnitamine`); member natural key is the
`/saadik/<uuid>/` segment; detail ballots read from the `#koik` tab (one row per
member) with choice map Poolt→yes, Vastu→no, Erapooletu→abstain, Ei hääletanud→neutral,
Puudub→absent.

**Why:** v0.1 next-slice step 2 — unblock real ingestion now that fixtures exist.

**Corrections to the prior fixture-capture entry's reconnaissance:** the
`4785afdf-…` detail page is **16 Poolt / 40 Vastu / 0 Erapooletu / 28 Ei hääletanud /
17 Puudub** in the `#koik` tab (101 members) — the earlier "98 Poolt / 242 Vastu" was
a cross-tab sum, not a single division. The 11.06.2025 listing has **30** result rows
(a 31st `haaletustulemused-` anchor is a sidebar quick-link the parser excludes).

**Gate:** `cd apps/scraper && uv run --extra dev ruff check . && uv run --extra dev
pytest -q` → `All checks passed! / 14 passed`. Note: dev tools are in the `dev` extra,
so the gate needs `--extra dev`.

**Touched:** `apps/scraper/src/.../{cli,models}.py`,
`apps/scraper/src/.../parsers/{vote_list,vote_detail,members}.py`,
`apps/scraper/tests/test_parsers.py`, and the three `fixtures/*.html`.

---

## 2026-06-14 — Capture live Riigikogu HTML fixtures; three parser corrections found

**What:** Pulled live HTML from `riigikogu.ee` and committed the three parser
fixtures: `apps/scraper/fixtures/vote_list.html` (busy day 11.06.2025, 31 votes),
`vote_detail.html` (the brief's UUID `4785afdf-60cd-428c-b521-a5370d6651bc`, a real
98-vs-242 division with 289 member ballot links), and `members.html` (current members
page). Raw investigation HTML left in gitignored `apps/scraper/raw_html/`.

**Why:** Step 1 of the v0.1 next-slice (fixtures unblock parser work and the first
backfill). The earlier "sandbox firewalled from riigikogu.ee" assumption did not hold
this session — egress worked, so capture was done directly rather than deferred to a
human/Actions run.

**Findings (drive the parser fixes, not yet applied to code):**
- Listing params are `startFrom`/`endTo` (+ redundant `startDate`), not
  `startDate`/`endDate`; `cli.py` builds the wrong URL today.
- The detail URL slug is always `kohalolekukontroll` for every vote type, so
  `vote_type_slug` must be derived from the vote title text, not the URL. This breaks
  the slug-based procedural filter assumption in `vote_list.py` and CLAUDE.md.
- Member links are `riigikogu-liikmed/saadik/<uuid>/<Name>`; the UUID is the natural
  key, but `members.py` currently grabs the trailing name segment.

**Verified:** All three pages fetched HTTP 200 and render the relevant data
server-side (no JS needed) — detail ballots and the day's vote table are both present
in raw HTML. Fixtures are git-untracked under `fixtures/` (committable) and
`raw_html/` is gitignored.

**Touched:** `apps/scraper/fixtures/{vote_list,vote_detail,members}.html`,
`progress.md`.

---

## 2026-06-14 — Add progress.md and progress-log.md

**What:** Created a two-file progress system: `progress.md` for the current snapshot
(status + next slice) and `progress-log.md` for append-only history. Updated
`CLAUDE.md` with the rule to keep them current.

**Why:** Multi-session work needs a durable "where are we" surface that's faster to
read than the full CLAUDE.md, plus an audit trail of what changed and why so future
sessions don't undo decisions or repeat work.

**Touched:** `progress.md`, `progress-log.md`, `CLAUDE.md`.

---

## 2026-06-14 — Bootstrap monorepo (v0.1 scaffold)

**What:** Initial scaffold for the parteidistsipliin project: pnpm workspace with
`apps/web` (Next.js 15 + TypeScript + next-intl ET/EN + Tailwind v4) and
`apps/scraper` (Python 3.11 + httpx + selectolax + psycopg + Typer, uv-managed),
plus `packages/db/migrations/0001_initial.sql` defining the schema and the discipline
views. Added GitHub Actions workflows for CI and a daily scrape, gitignore, env
examples, and project-level README + CLAUDE.md.

**Why:** Stand up the smallest end-to-end shape for v0.1 (sortable members list with
overall discipline score) so the first real data and deploy can land without
re-arguing layout or stack choices.

Key decisions captured during the quiz (locked in CLAUDE.md):
- "Voting against party" = majority of own faction voted differently, computed with
  self excluded from the majority denominator.
- Procedural votes (`kohaloleku kontroll`, `päevakorra kinnitamine`) are excluded
  from the score via a `procedural_vote_types` lookup table — adding a new
  procedural type is a single `INSERT` with no code change.
- Scope cap for v0.1 is members list + score. Timeline + party-switch line move to
  v0.2.
- Seed scrape = full 15th Riigikogu term (2023-).
- Stack: Next.js full-stack on Vercel + Python scraper running from GitHub Actions
  cron, writing to Neon Postgres.

**Verified:** Migration applies cleanly to local Postgres 16. `member_discipline`
view returns correct counts against synthetic 3-MP / 2-vote dataset including the
procedural-vote exclusion. `pnpm typecheck`, `pnpm --filter web build`, ESLint, ruff,
and pytest all pass.

**Touched:** new repo, see commit `b65ea84`.
