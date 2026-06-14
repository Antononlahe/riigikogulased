# CLAUDE.md

Notes for AI assistants (and humans) working on this repo. Keep it current.

## Working rhythm — read this first

Two files track work-in-flight and you are expected to keep them current:

- **`progress.md`** — single snapshot of "where are we now". Open it at the start of
  every session. Update it (in place — overwrite, don't append) whenever the current
  status or the next work slice changes: a feature lands, a blocker is hit, the
  current slice is finished and a new one is chosen. Keep it short.
- **`progress-log.md`** — append-only history. After any meaningful code or data
  change (a commit, a schema migration, a non-trivial refactor, a decision reversed),
  prepend a new dated entry at the top in the documented format. The log is the
  audit trail; don't rewrite past entries.

If you're about to commit, ask yourself: "did I update both files?" If only one or
the other, that's usually a sign something is off — `progress-log.md` always gets a
new entry; `progress.md` gets edited whenever the answer to "what's next" shifts.

## What this is

A public dashboard that surfaces how loyal each Riigikogu (Estonian parliament) member is to
their party's voting line, based on the official Riigikogu vote archive. The point is
journalism / civic transparency, not real-time analytics.

## Scope ladder

The full roadmap (researched + approved 2026-06-14) lives in
`~/.claude/plans/can-you-go-over-crystalline-beacon.md`, summarized in `progress.md`.
Four governing decisions shape everything below:

1. **Ingestion migrates to the official Open Data API** — `api.riigikogu.ee` (JSON,
   stable UUIDs, CC-BY-SA, **1 req/sec** limit, OpenAPI spec at `/v3/api-docs`). The
   HTML parsers were **removed** in the v0.2 cutover (done) — the API is the only
   ingestion source; reintroduce a parser only if a concrete API data gap appears. The
   API exposes far more than the
   public HTML: full member bios, committees, Riigikogu terms, speeches/stenograms,
   bills+sponsors, interpellations, written questions, EU docs, a Eurovoc subject
   taxonomy, seating, events, and pre-computed voting/speech/participation statistics.
2. **Schema is laid down now for four domains** — votes (have), speeches, bills,
   oversight — so later UI is additive, not migratory.
3. **Topic categorization uses official Eurovoc tags**, not manual rules / LLM.
4. **UI is first-class from v0.2** — design system + charts + motion (see below).

| Version | Status | Features |
| --- | --- | --- |
| v0.1 | shipped | Members list, overall discipline %, sortable. 15th Riigikogu. Live on Vercel. (Open: GH Actions `DATABASE_URL` secret unset, so the daily cron can't write yet.) |
| v0.2 | current | API migration + member detail pages (vote timeline, party-switch lines) + design-system foundation. Model committees, terms, sittings/sessions, districts; enrich member record. |
| v0.3 | | Eurovoc topics: link votes->bills->subjects; filter discipline by topic. |
| v0.4 | | Party / faction / committee rollups (cohesion). |
| v0.5 | | Speeches & stenogram activity (how much / on what topics each MP speaks). |
| v0.6 | | Bills & sponsorship (what each MP authored / co-sponsored, outcomes). |
| v0.7 | | Oversight: interpellations, written questions, attendance/participation. |
| v1.0 | | Search, social share cards, historical backfill across terms, polish, ET/EN review. |
| post-1.0 | | "MP activity profiler" — comparison, leaderboards, topic explorer, maverick index, coalition dynamics. See roadmap doc. |

Stay inside the current version's scope. New ideas go to the roadmap doc / GitHub issues,
not into the diff.

**UI stack (from v0.2):** keep Next.js App Router + Tailwind + next-intl on Vercel; add
shadcn/ui (Radix) for components, Recharts for standard charts + visx/D3 for bespoke
visuals (vote timeline, agreement matrix, hall plan), Framer Motion + Next.js View
Transitions for motion. One shared party-color token palette (RE/EKRE/KE/E200/SDE/I);
light/dark; mobile-first; honor `prefers-reduced-motion`.

## Architecture

```
api.riigikogu.ee (JSON, 1 req/s)  ->  apps/scraper (Python, cron'd from GitHub Actions)
                                                |
                                                v
                                         Postgres (Neon)
                                                ^
                                                |
                                         apps/web (Next.js on Vercel) -> users
```

The scraper writes; the web app only reads. There is no write path from the web app.
**Ingestion source (v0.2+):** the official Open Data API is the sole source. The HTML
parsers were removed in the v0.2 cutover; the `parsers/` package is an empty placeholder
kept only as a home for a future fallback if an API data gap is ever found. Raw API JSON
is archived per-domain in the git-committed cache (`apps/scraper/cache/api/`) so the
offline `rebuild` command reproduces the DB with no network.

## Core metric: "voting against party"

For a vote V and member M who belongs to party P at time of V:

1. If V is a procedural vote (`vote_type_slug` in `procedural_vote_types`) — exclude.
   Default exclusions: `kohalolekukontroll` (presence check) and
   `paevakorra-kinnitamine` (agenda adoption). These are routine and noisy.
   Note: `vote_type_slug` is derived from the voting's **description** (e.g. "Kohaloleku
   kontroll" -> `kohalolekukontroll`) via `api_parse.vote_type_slug`. The API also carries
   a cleaner `type.code` discriminator (`KOHALOLEKU_KONTROLL`, `AVALIK`, ...); the cutover
   kept deriving the slug from the description to preserve identical scoring, and switching
   the discriminator to `type.code` is a deferred follow-up.
2. Take every M' in P (at time of V), excluding M.
3. Compute the majority position of {M'}: yes / no / abstain, by strict majority.
4. If no choice has strict majority — exclude V from M's score (party was split).
5. If M's choice is `absent` — exclude V from M's score (no signal).
6. Otherwise: `aligned` if M's choice == party majority, else `defection`.

`discipline_score = aligned / (aligned + defection)`.

This logic lives in SQL views in `packages/db/migrations/0001_initial.sql`. If you
change the definition, update both the SQL and this section.

To exclude an additional procedural type, `INSERT INTO procedural_vote_types`. The
discipline view consults the table, so no code change is needed.

## Conventions

- **Language in code/comments**: English. UI strings (in `apps/web/messages/`) are
  translated via next-intl; ET is the default locale.
- **Estonian terminology**: keep domain words in Estonian where it'd be unnatural in
  English — `fraktsioon` (parliamentary faction), `Riigikogu`, party names. Comment them
  briefly the first time they appear in code.
- **IDs from Riigikogu**: every entity has a `riigikogu_id` column. Treat it as the
  natural key. For members it is the API `uuid` (same value as the UUID segment of the
  profile URL `/riigikogu-liikmed/saadik/<uuid>/<Name>`, not the trailing name slug). Do
  not delete rows; party switches are modeled as `member_party_terms` with `ended_on`.
  A member who leaves a fraktsioon becomes **non-attached**: their open term is closed
  and a new term with `party_id = NULL` is opened (the scraper records party <->
  non-attached transitions, not just party-to-party). Non-attached members are excluded
  from discipline scoring. Fraktsioon names are mapped to seeded party abbreviations
  (RE, EKRE, KE, E200, SDE, I) via `models.faction_to_party`.
- **Ingestion politeness**: the API allows **max 1 request/second per IP** (it returns
  429 above that — observed live); `ApiClient` hard-throttles to 1 req/s and backs off on
  429/5xx. Identify with the configured user-agent and attribute data under
  **CC-BY-SA 3.0**. Tests run offline against committed fixtures under
  `apps/scraper/fixtures/api/`; the `rebuild` command replays the committed raw cache
  under `apps/scraper/cache/api/` with no network.
- **No emoji in code, commits, or docs.**

## Data model (cheatsheet)

Current (migration `0001_initial.sql`):

- `parties` — fraktsioons
- `members` — MPs (one row forever, even across terms). v0.2/A2 enriched it with
  `date_of_birth`, `date_of_death`, `gender`, `email`, `phone`, `parliament_seniority_days`,
  `mandate_started_on`, and photo columns (`photo_uuid`, `photo_file_name`, `photo_url`,
  `photo_thumb_path`).
- `member_party_terms` — `(member_id, party_id, started_on, ended_on)` history
- `votes` — individual vote events. v0.2/A2 added `sitting_id` (FK `sittings`) and the
  bill bridge `draft_uuid` / `draft_title` / `draft_mark` (from the voting's
  `relatedDraft`; nullable, FK to a future bills table deferred to v0.6).
- `ballots` — `(vote_id, member_id, choice)`, choice in `yes|no|abstain|absent|neutral`
- `procedural_vote_types` — slugs excluded from discipline scoring
- Views: `member_vote_alignment`, `member_discipline`, `member_current_party` (unchanged
  by A2 — discipline scores are byte-identical across the 0002 migration)

Current (migration `0002_structure.sql`, v0.2/A2):

- `schema_migrations` — `(version, applied_at)`; migrations are applied by
  `db.apply_migrations()`, which `rebuild` runs automatically. 0001 is backfilled.
- `riigikogu_terms` — koosseis by `number` (seed: 15)
- `sessions` — istungjärk `(term_id, number, type_code KORRALINE|ERAKORRALINE, started_on,
  ended_on)`, from `/api/sessions` (archived to `cache/api/sessions.json`)
- `sittings` — istung `(riigikogu_uuid, session_id, term_id, title, sitting_date)`; a
  sitting maps to its session by date containment (narrower range wins on overlap), done
  in `writer._write_sitting` / `enrich.map_sitting_to_session`
- `committees` + `member_committee_terms` — from each member's `committees[]`
- `electoral_districts` + `member_district_terms` — from each member's
  `electoralDistrictHistory[]`

Member photos: the `photos` CLI command downloads each member photo via the API,
compresses it to a WebP thumbnail under `apps/web/public/members/<uuid>.webp` (committed,
served statically by Next.js) and records `photo_thumb_path`; the full-res image stays a
runtime URL (`photo_url`).

Planned (v0.3+ migrations, designed up front — see roadmap doc): `volumes` (generic
dossier: drafts / interpellations / written-questions / EU / collective-addresses by
type), `bills` + `bill_sponsors` + `bill_readings`, `speeches`, `eurovoc_descriptors` +
`volume_topics`. `votes.draft_uuid` becomes a real FK once `volumes`/`bills` land, so
vote -> bill -> Eurovoc topics resolves.

## Things to be careful about

- The API gives ISO dates/datetimes (`startDateTime` etc.); pydantic parses them at the
  model boundary. `votes.riigikogu_uuid` is the voting `uuid` from `/api/votings/{uuid}`.
- The vote type comes from the voting's `description`/`type.code`, not a URL slug.
- A member's faction can change mid-term (defections, party splits, joining the
  unaffiliated bench). The per-ballot `faction` in each voting (`voters[].faction`) is the
  source of truth for faction-at-time; `member_party_terms` is built from it in
  chronological order. Cross-check after each run.
- "Absent" (`PUUDUB`) vs "did not vote" (`EI_HAALETANUD` -> neutral) vs "abstain"
  (`ERAPOOLETU`) — the API distinguishes these via `decision.code`; map precisely in
  `api_parse.decision_to_choice` and don't collapse them. `KOHAL` (present, in presence
  checks) is intentionally dropped.

## Network policy in dev sandboxes

This repo is sometimes opened in restricted-egress environments that can't reach
`riigikogu.ee` / `api.riigikogu.ee` directly. In that case:
- Run the scraper locally or in GitHub Actions, not in the sandbox.
- Tests in `apps/scraper/tests/` parse committed fixtures under `fixtures/api/`, and the
  offline `rebuild` replays the git-committed raw cache under `cache/api/` — both should
  always work offline.

## Deferred / open

- Close out v0.1: set the GH Actions `DATABASE_URL` secret so the daily cron can write.
- Vote topic classification — **decided: official Eurovoc tags from the API** (no manual
  rules / LLM). Wire up in v0.3.
- Caching strategy for the dashboard once timeline charts land (likely ISR with 1h
  revalidate).
- Robots.txt / licensing compliance is currently informal — formalize CC-BY-SA
  attribution and the 1 req/s limit before going public.
