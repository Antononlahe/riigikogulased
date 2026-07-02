# CLAUDE.md

Notes for AI assistants (and humans) working on this repo. Keep it current.

## What this is

A public dashboard that surfaces how loyal each Riigikogu (Estonian parliament) member is to
their party's voting line, based on the official Riigikogu vote archive. The point is
journalism / civic transparency, not real-time analytics.

## Stack

- **Ingestion**: the official Open Data API `api.riigikogu.ee` (JSON, stable UUIDs,
  CC-BY-SA, **1 req/sec** limit, OpenAPI spec at `/v3/api-docs`) is the only source
  (bar the äriregister gap noted under Architecture). It exposes full member bios,
  committees, Riigikogu terms, speeches/stenograms, bills+sponsors, interpellations,
  written questions, EU docs, a Eurovoc subject taxonomy, seating, events, and
  pre-computed statistics.
- **Topics**: categorization uses official Eurovoc tags from the API, not manual rules
  / LLM.
- **Web**: Next.js App Router + Tailwind + next-intl on Vercel; shadcn/ui (Radix)
  components, Recharts + visx/D3 for charts, Framer Motion + View Transitions for
  motion. One shared party-color token palette (RE/EKRE/KE/E200/SDE/I); light/dark;
  mobile-first; honors `prefers-reduced-motion`.

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
**Ingestion sources (v0.2+):** the official Open Data API is the primary source. A **second
source** was added for one concrete API gap: the Riigikogu API carries only **fraktsioon**
(parliamentary faction) membership, never **erakond** (party) membership, so party (erakond)
membership comes from the **äriregister political-party registry** (`ariregister.rik.ee/
est/political_party/`, server-rendered HTML, matched to members by **name + date of birth**;
client/parser in `ariregister_*.py`, populated by the `erakond` CLI command). Raw JSON
(API) and raw HTML (äriregister) are archived in the git-committed cache
(`apps/scraper/cache/{api,ariregister}/`) so the offline `rebuild` reproduces the DB with no
network. The äriregister cache is stored **gzip-compressed** (`*.html.gz`, ~2.6MB) because
the raw search pages are large fuzzy result sets (`AriregisterCache` handles compression).

## Deploying the web app (READ THIS before touching deps or deploying)

The live site is **https://parteidistsipliin.vercel.app** (Vercel project `parteidistsipliin`,
linkage committed under `apps/web/.vercel`). The project is **pnpm-only** (unified 2026-06-15):
`apps/web` is a standalone pnpm app (`apps/web/pnpm-lock.yaml`, `packageManager: pnpm@9.12.0`);
there is **no** root pnpm-workspace and **no** npm lockfile anywhere. Use `corepack pnpm`
locally (`corepack pnpm -C apps/web <script>`, or the root passthroughs `pnpm -C apps/web …`).

Deploy with the Vercel CLI **from `apps/web`**:

```
cd apps/web && vercel --prod --yes      # CLI authed as antononlahe; binary /c/nvm4w/nodejs/vercel
```

Hard-won rules (a 2026-06-15 deploy burned an hour on these — do not repeat):

- **Deploy FROM `apps/web`, not the repo root.** Vercel's Root Directory is the `apps/web`
  linkage; the root `package.json` has no `next`, so a root deploy fails with
  *"No Next.js version detected."* Do not create a `.vercel` at the repo root.
- **Use pnpm for web deps, never npm.** Add/change deps with `corepack pnpm -C apps/web add …`
  (or edit `package.json` then `corepack pnpm -C apps/web install`), which keeps
  `apps/web/pnpm-lock.yaml` consistent; commit it. Do NOT run `npm install` in `apps/web`
  (creates a stray `package-lock.json` that drifts) and never hand-patch a lockfile — an
  inconsistent lockfile makes the Vercel install prune `next` → *"No Next.js detected."*
- `generateStaticParams` (member pages) reads the DB at build time; Vercel has `DATABASE_URL`
  set, and prod must already be on the required migration (e.g. C needs `0003`) before deploy.

## Core metric: "voting against party"

**Two parties matter (v0.2+): fraktsioon vs erakond.** A member's **scoring party** for a
vote V is: the party of the **fraktsioon** they sit in at time of V if they are in one;
otherwise their **erakond** (party) membership at that time (from äriregister); otherwise
they are excluded (truly independent). Fraktsioon wins when present — this covers both "in
EKRE's faction but not an EKRE party member" (scored against EKRE) and "left the faction
bench but still a Reformierakond member" (scored against RE).

For a vote V and member M with scoring party P at time of V:

1. If V is a procedural vote (`vote_type_slug` in `procedural_vote_types`) — exclude.
   Default exclusions: `kohalolekukontroll` (presence check) and
   `paevakorra-kinnitamine` (agenda adoption). These are routine and noisy.
   Note: `vote_type_slug` is derived from the voting's **description** (e.g. "Kohaloleku
   kontroll" -> `kohalolekukontroll`) via `api_parse.vote_type_slug`. The API also carries
   a cleaner `type.code` discriminator (`KOHALOLEKU_KONTROLL`, `AVALIK`, ...); the cutover
   kept deriving the slug from the description to preserve identical scoring, and switching
   the discriminator to `type.code` is a deferred follow-up.
2. Compute P's **party line**: the strict-majority position (yes/no/abstain) among the
   **fraktsioon members of P** at time of V (NOT erakond-only members). Exclude M's own
   ballot from the line only when M is themselves a fraktsioon member of P.
3. If no choice has strict majority — exclude V from M's score (party was split).
4. If M's choice is `absent` — exclude V from M's score (no signal).
5. If P has no fraktsioon (e.g. M's erakond is a non-parliamentary party) — there is no line,
   so V is excluded for M.
6. Otherwise: `aligned` if M's choice == party line, else `defection`.

`discipline_score = aligned / (aligned + defection)`.

This logic lives in SQL views in `packages/db/migrations/0003_erakond.sql` (which replaced
the simpler faction-only views from `0001_initial.sql`). If you change the definition,
update both the SQL and this section. Faction-member scores are byte-identical to the
pre-erakond metric; erakond only adds non-attached party members who were previously
excluded.

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
  not delete rows; faction switches are modeled as `member_faction_terms` with `ended_on`
  (renamed from `member_party_terms` in `0003`). A member who leaves a fraktsioon becomes
  **non-attached**: their open faction term is closed and a new one with `party_id = NULL`
  is opened. Non-attached members no longer score 0 automatically — their **erakond**
  (party) membership from `member_erakond_terms` is used as the scoring fallback (see Core
  metric). Fraktsioon names map to seeded abbreviations (RE, EKRE, KE, E200, SDE, I) via
  `models.faction_to_party`; erakond parties map by **registration code** (`parties.
  registry_code`) then display-name via `ariregister_models.registry_code_to_party` /
  `name_to_party`.
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
- `member_party_terms` -> **renamed `member_faction_terms` in `0003`** —
  `(member_id, party_id, started_on, ended_on)` fraktsioon history (`party_id NULL` =
  non-attached). Built from per-ballot `voters[].faction`.
- `votes` — individual vote events. v0.2/A2 added `sitting_id` (FK `sittings`) and the
  bill bridge `draft_uuid` / `draft_title` / `draft_mark` (from the voting's
  `relatedDraft`; nullable, FK to a future bills table deferred to v0.6).
- `ballots` — `(vote_id, member_id, choice)`, choice in `yes|no|abstain|absent|neutral`
- `procedural_vote_types` — slugs excluded from discipline scoring
- Views: `member_vote_alignment`, `member_discipline`, `member_current_party` — **reworked
  in `0003`** for faction-first/erakond-fallback scoring and the faction-only party line;
  `member_current_party` gained an `in_faction` boolean. Faction-member scores are
  byte-identical to the pre-erakond metric.

Current (migration `0003_erakond.sql`, v0.2/erakond reconciliation):

- `member_erakond_terms` — `(member_id, party_id, started_on, ended_on, source)` party
  (erakond) membership from the äriregister registry. `party_id NULL`/unmapped parties have
  no Riigikogu faction, so such members are excluded from scoring. `started_on`/`ended_on`
  may be NULL (NULL start = "always", NULL end = "current").
- `parties.registry_code` — 8-digit RIK registration code per seeded party (informational;
  seeded by `0003` and kept in sync with `ariregister_models._CODE_TO_PARTY`, which is the
  dict actually used to map registry memberships to our six parties — the column itself is
  not read by any view).

Current (migration `0005_eurovoc.sql`, v0.3/D1 Eurovoc topics):

- `eurovoc_fields` — 21 top-level Eurovoc fields `(efid PK, uuid, code, text_et, text_en)`.
- `eurovoc_microthesauri` — 127 microthesauruses `(etid PK, …, field_efid FK)`.
- `eurovoc_descriptors` — subject descriptors `(edid PK, …, microthesaurus_etid FK)`. The
  taxonomy (`fields`→`microthes`) only yields each microthesaurus's **top-level** descriptors
  (~538); bills also cite **narrower** descriptors that the API exposes only as `narrowTerms`
  UUIDs with no usable ancestry (`hierPaths`/`broaderTerms`/`microThesauruses` empty), so those
  are inserted from the bill's `{edid,text}` with `microthesaurus_etid NULL` — captured but with
  no field rollup. Net: descriptor-level topic filtering is complete; broad-**field** faceting
  resolves for ~38% of bills (88/233). Lifting field coverage would need a recursive
  `narrowTerms` crawl — deferred (out of D1 scope).
- `volume_topics` — `(draft_uuid, descriptor_edid)` bill→descriptor links (`draft_uuid` =
  `votes.draft_uuid`; FK to a `bills`/`volumes` table deferred to v0.6).
- View `vote_topics` — `(vote_id, descriptor_edid, microthesaurus_etid, field_efid)`: a vote
  resolved through its bill to descriptors + the rollup. Topic-filtered discipline (D2) is
  `member_vote_alignment ⋈ vote_topics` filtered by `descriptor_edid`/`field_efid`, then
  aggregated exactly like `member_discipline` — **no new scoring logic, discipline unchanged**.
- Ingested by the `eurovoc` CLI command (taxonomy fields+microthes in et+en, then per-
  `draft_uuid` `/api/volumes/drafts/{uuid}` descriptors). Raw JSON archived under
  `cache/api/{eurovoc,drafts}/` (committed) so offline `rebuild` reproduces `volume_topics`.

Current (migration `0006_alignment_matview.sql`, v0.3/D2):

- `ballot_alignment` — a **materialized view** caching `member_vote_alignment`
  `(vote_id, member_id, party_id, member_choice, is_procedural, party_majority_choice)`,
  unique-indexed by `(vote_id, member_id)`. It is purely a **cache** of the view — the discipline
  definition is unchanged. Rationale: `member_vote_alignment` recomputes party-at-time per ballot
  via correlated subqueries (~9s to materialize fully) and can't be filtered by vote, so the v0.3/D2
  per-topic queries (which join alignment to `vote_topics` by `vote_id`) were ~9s/page; reading the
  matview makes them ~18ms. The **web topic queries (`apps/web/lib/topics-queries.ts`) read
  `ballot_alignment`**, never `member_vote_alignment` directly. Refresh it with
  `db.refresh_alignment(conn)` (a plain `REFRESH MATERIALIZED VIEW`) **after any ingest that changes
  ballots/votes/faction/erakond terms** — wired into `_scrape_range` (backfill/daily, but only when
  new votings landed), `rebuild`, and `erakond`. The `members`/`eurovoc`/`photos` commands don't
  change alignment inputs, so they don't refresh. Apply migrations without a full rebuild via the
  **`migrate` CLI command**
  (`db.apply_migrations`); the matview is created+populated at migration time.

Current (migration `0022_decisive.sql`, decisive votes):

- `votes.required_majority` — `'simple'` (poolthäälteenamus, yes > no) or `'members'`
  (koosseisu häälteenamus, >= 51 yes). The API does not expose the passage rule; it is
  derived at ingest by `api_parse.required_majority` from the vote slug + draft/document
  titles (umbusaldusavaldus PS §97, ettepanek Vabariigi Valitsusele RKKTS §154 lg 2,
  saadikupuutumatus PS §76, PS §104 laws by title pattern — annual "N. aasta riigieelarve"
  excluded). NB: draftTypeCode `UA` means a confidence-tied bill (usaldusküsimus), which is
  simple majority — not umbusaldus. Backfill via the `thresholds` CLI (offline, from the
  votings cache); `rebuild` reproduces it.
- `votes.document_title` — `relatedDocument` title (umbusaldus votings carry no draft).
- View `vote_decisiveness` — per non-procedural vote: defection counts, counterfactual
  yes/no if every defector voted the party line, passed/cf_passed under the correct
  threshold, and `flip_gap` (closeness). Reads the `ballot_alignment` matview. Feeds
  `/statistika/otsustavad` (discipline scoring untouched).

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

## Things to be careful about

- The API gives ISO dates/datetimes (`startDateTime` etc.); pydantic parses them at the
  model boundary. `votes.riigikogu_uuid` is the voting `uuid` from `/api/votings/{uuid}`.
- The vote type comes from the voting's `description`/`type.code`, not a URL slug.
- A member's faction can change mid-term (defections, party splits, joining the
  unaffiliated bench). The per-ballot `faction` in each voting (`voters[].faction`) is the
  source of truth for faction-at-time; `member_faction_terms` is built from it in
  chronological order. Cross-check after each run.
- **äriregister matching gotcha:** the registry search is fuzzy (matches first OR last name)
  and only renders a "member history" link for people with a **multi-party** history.
  Members with one stable membership have no link — their current party is read from the
  search **card** instead (`card_to_party_term`). Identity is resolved by exact **name +
  date of birth**; never trust the search by name alone.
- "Absent" (`PUUDUB`) vs "did not vote" (`EI_HAALETANUD` -> neutral) vs "abstain"
  (`ERAPOOLETU`) — the API distinguishes these via `decision.code`; map precisely in
  `api_parse.decision_to_choice` and don't collapse them. `KOHAL` (present, in presence
  checks) is intentionally dropped.
