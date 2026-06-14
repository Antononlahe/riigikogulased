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
