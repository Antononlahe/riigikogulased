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
