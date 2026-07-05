# Statistics ("Fun stats") — implementation plan

A build-out of the `/statistika` tab into a richer, mobile-first statistics hub. Extends the
existing tab (which already has speakers, kulud, otsustavad) with a set of demographic,
biographical and behavioural stats drawn from the member CV pages and data we already hold.

Status: design/plan. Not yet approved for implementation.

---

## 1. Scope

In (13 features, grouped by the data they need):

| # | Feature | Estonian label | Data source |
|---|---------|----------------|-------------|
| 13 | Ghost-MP (absence leaderboard) | Kohalolek | **have** — `ballots.choice='absent'` |
| 19 | Generational blocks | Põlvkonnad | **have** — `members.date_of_birth` |
| 12 | Signature words | Märgusõnad | **have** — `member_speeches` (lemmatised) |
| 2  | Career before politics + diversity | Taust / elukutsed | CV scrape |
| 2b | Words by profession/degree | (feeds Märgusõnad) | CV scrape × `member_speeches` |
| 3  | University by party | Ülikoolid | CV scrape |
| 1  | Hobby cloud (by-party vs cross-party) | Huvialad | CV scrape |
| 4  | Baby count | Lapsed | CV scrape |
| 5  | Languages | Keeled | CV scrape |
| 6  | Honours | Teenetemärgid | CV scrape |
| 7  | Birthplace map | Sünnikoht | CV scrape |
| 14 | Workhorse (bills initiated/led) | Töömesilane | CV scrape (counts) |
| 8  | Friendship-group map | Parlamendirühmad | CV scrape (same pages) |
| 9  | Cause caucuses network | Toetusrühmad | CV scrape (same pages) |
| 20 | Spirit card | Saadikukaart | composite of all of the above |

Out (explicitly):

- **Anything keyed on defection/discipline.** Overall defection is very low, so cross-tabs
  against discipline carry no signal. Discipline stays confined to its existing pages
  (`/`, factions, `otsustavad`). None of the new stats use it.
- Full bills+sponsors ingest / co-sponsor network. Workhorse ships as **counts only**, read
  off the profile page. A real sponsor graph is a v0.6 follow-up (see §9).

## 2. Locked decisions (assumptions — flip any of these before build)

The quiz went unanswered, so these are the working defaults; each is the laziest option that
still delivers the by-party cross-tabs:

1. **Categorisation of freeform CV text → one-time LLM tagging, committed as data.** A fixed
   tag taxonomy (per field: hobbies, professions); an offline LLM pass maps each member's
   freeform values to tags **once**, and the result is committed as `profile_tags.json`
   (raw phrase → canonical tag). `rebuild` reads that committed map — it never calls an LLM —
   so the pipeline stays reproducible. NB this is a deliberate exception to the repo's
   "official tags, not LLM" rule (which is about the discipline *topic* taxonomy, where an
   official Eurovoc taxonomy exists; hobbies/professions have none). Universities still map via
   a small closed-set dictionary (no LLM needed). Untagged phrases fall through to "Muu" and
   are still counted individually.
2. **Workhorse = counts from the CV scrape** (initiated/led bill counts per member). No new
   bills table.
3. **Birthplace map = town pins.** A committed `town → (lat, lon)` lookup for Estonian
   settlements; dots on an inline Estonia SVG, sized/clustered where several MPs share a town
   (Tallinn). No geocoding service. Unknown town → fail loudly (so it gets added, not dropped).
4. **Spirit card = stat sheet + computed archetype label** ("Kõnemees", "Kummitus",
   "Töömesilane", …).

## 3. Architecture fit

Unchanged from the current design:

```
member profile pages (HTML, 1 req/s)  ->  apps/scraper `profiles` cmd  ->  Postgres
                                                                              ^
                                              apps/web /statistika  --------- (reads only)
```

- The scraper writes, the web app reads. Same as today.
- Raw HTML archived (gzip) in the git-committed cache so offline `rebuild` reproduces the DB
  with no network — same pattern as `ariregister` and `verbatim` caches.
- New `/statistika` routes are **statically rendered** (`revalidate = 86400`, no
  `searchParams`) → CDN-cached, instant tab switches, matching the existing pages.
- All new tables are **additive**: no existing view, and specifically no discipline/alignment
  view, is touched.

## 4. New scraper: the `profiles` command

One command scrapes every member profile page once (~101 pages, 1 req/s ≈ 2 min) and yields
**everything** CV-derived. It reuses the `ariregister_client` throttle + gzip-cache pattern.

```
python -m parteidistsipliin_scraper profiles [--refresh]
```

Cache: `apps/scraper/cache/profiles/<uuid>.html.gz`. Parser: `profile_parse.py`. Offline
`rebuild` replays the cache. The profile URL is
`/riigikogu/koosseis/riigikogu-liikmed/saadik/<uuid>/<Name>` — `<uuid>` is the same member
`riigikogu_id` we already store, so no new id resolution.

What the parser extracts per member (all present on the page, confirmed live):

- `birthplace_town`, `birth date` (already have DOB; use as a cross-check)
- `children_count` + `family_status_raw` (from "Abielus, neli last")
- education list → `(institution, degree, year)`; canonical university via dictionary
- career list → `(org, role, years)`; pre-politics profession tag via dictionary
- `huvialad` (hobbies) → tags + raw
- languages (when the page lists them)
- honours/decorations → raw + country + `is_foreign`
- `bills_initiated`, `bills_led` (counts from "Algatatud/Juhitud eelnõud")
- friendship groups (Eesti–X) and cause caucuses (toetusrühmad) → names
- social links (informational; not a stat, but cheap to keep)

### Tagging (offline LLM pass, committed result)

- `UNIVERSITIES` stays a committed closed-set dictionary in `profile_tags.py` (canonical +
  aliases, ~15), modelled on the existing `faction_to_party` mapping — no LLM.
- Hobbies + professions are tagged by a **one-time offline LLM step** (`profiles --tag`) that
  reads the scraped raw phrases and a fixed tag taxonomy, and writes `cache/profiles/
  profile_tags.json` (`raw phrase → canonical tag`). The taxonomy (the allowed tag set per
  field) is committed and version-controlled; the LLM only assigns existing phrases to it.
- The writer joins raw phrases → tags **through the committed JSON**, so `rebuild` and CI are
  fully offline and deterministic. New phrases from a later scrape that aren't in the JSON fall
  through to "Muu" until the tag step is re-run — logged, never silently dropped.

## 5. Data model (new migrations)

All additive, `BEGIN/COMMIT`, joined to `members(id)`. Following the `member_expenses` style.

```
0023_member_profiles.sql
  member_profiles(member_id PK, birthplace_town,
                  birthplace_lat NUMERIC, birthplace_lon NUMERIC,  -- for pins
                  children_count INT, family_status_raw,
                  bills_initiated INT, bills_led INT,
                  social JSONB, scraped_at)

  member_hobbies    (member_id, hobby_tag, raw)         -- tag via committed profile_tags.json
  member_professions(member_id, profession_tag, raw)    -- pre-politics, same tagging
  member_education  (member_id, university_canonical, degree, grad_year, raw)
  member_languages  (member_id, language)
  member_honours    (member_id, raw, country, is_foreign BOOL)
  member_caucuses   (member_id, kind, name)             -- kind in ('friendship','cause')
```

`kind` split lets one table serve both the friendship map (#8) and the cause network (#9).

```
0024_signature_terms.sql
  signature_terms(scope_kind, scope_id, lemma, score, rank)
                  -- scope_kind in ('member','party'); top-N distinctive lemmas
```

Signature words are **precomputed** (TF-IDF over `member_speeches` lemmas) in a build step and
stored top-N per scope, not computed at request time. Rationale: same as the
`ballot_alignment` matview — keep pages at ~ms, not seconds. Refresh alongside `verbatims`
ingest.

No new views are strictly required; the by-party rollups are cheap `GROUP BY` reads. If any
proves slow it becomes a matview later (note the ceiling, don't pre-build it).

## 6. Web — the `/statistika` hub

### Route tree

The existing pages are **left exactly as they are**. Everything new lives under a new, separate
`/statistika/varia` subtree with its own hub — it is not mixed in with speeches.

```
/statistika                     speakers        (EXISTS — untouched)
/statistika/kulud               expenses        (EXISTS — untouched)
/statistika/otsustavad          decisive        (EXISTS — untouched)

/statistika/varia               NEW hub landing (grid of stat tiles + headline numbers)
/statistika/varia/kohalolek     ghost-MP        (Phase 0)
/statistika/varia/margusonad    signature words (Phase 0)
/statistika/varia/polvkonnad    generational    (Phase 0)
/statistika/varia/inimesed      CV bundle: hobbies, professions, universities,
                                languages, honours, children, birthplace  (Phase 1)
/statistika/varia/vorgustik     friendship map + cause caucuses           (Phase 1)
/statistika/varia/kaardid       spirit-card gallery                       (Phase 2)
```

Nav: add a single **"Varia"** link → `/statistika/varia`. The existing speeches/expenses/
decisive nav links stay as-is.

### Hub landing UX

- A responsive **card grid** (1 col mobile → 2 → 3), each tile = one stat: icon, title,
  one-line teaser, and a headline number pulled live (e.g. "Kõige kummituslikum: X — 34%
  puudumist"). Tapping a tile → its route.
- Above the grid, a compact **headline strip** (the parliament in numbers: 101 members,
  N women, avg age, total children, most common hobby) — the `arvud-räägivad` vibe, but ours.
- Mobile-first: tiles stack, headline strip becomes a horizontal snap-scroll of stat chips.

### Per-feature rendering

Reuse the existing conventions everywhere: `ScrollableTable` desktop / card-list mobile,
`MemberAvatar`, `PartyBadge`, `partyToken` colours (RE/EKRE/KE/E200/SDE/I), light/dark,
`prefers-reduced-motion`, `et` default locale, all strings via `messages/*/statistika`.

| Feature | Primary viz | Mobile |
|---------|-------------|--------|
| Ghost-MP | sortable leaderboard (absence %, present %, tenure context) | member cards |
| Generational | stacked age-cohort bars by party + youngest/oldest callouts | stacked bars, cards |
| Signature words | per-party word chips (sized by score) + per-member on profile | chip wrap |
| Hobbies | tag cloud + "by party" small-multiples + cross-party shared vs unique | cloud + chips |
| Professions | by-party diversity bars (distinct-professions / members) + top list | bars |
| Universities | alma-mater league table + by-party breakdown | table→cards |
| Languages | polyglot leaderboard + language frequency bars | bars |
| Honours | honours wall (grid of members w/ decorations), domestic vs foreign split | grid |
| Children | baby-count leaderboard + avg-per-party + parliament total | bars |
| Birthplace | **town pins** on inline Estonia SVG (dot size = MP count) + town list | tap pin/town → member list |
| Workhorse | initiated/led leaderboard + by-party totals | cards |
| Friendship map | country-popularity bars + "globetrotter" (most groups) leaderboard | bars |
| Cause caucuses | cross-party caucus **network graph** (force layout) + per-cause reach | list fallback |

Diversity metric (professions #2): **distinct profession tags ÷ members**, per party — a simple
"most/least varied bench" score. Also surfaces the single most over-represented profession per
party. Words-by-profession (#2b) = signature-word chips filtered to a profession/university
cohort, rendered on the Märgusõnad page as an optional facet.

Birthplace pins need a committed Estonia outline SVG (public-domain Maa-amet / Wikimedia) as a
static asset plus the `town → (lat, lon)` lookup — no runtime map lib. Pin position = project
lat/lon onto the SVG's bounding box; overlapping MPs at one town collapse into a single count-
sized dot that opens the member list on tap.

Cause-caucus network is the one non-trivial viz; use `visx`/D3 force (already a dep). Mobile
fallback = per-cause list with cross-party member chips (a force graph is unreadable on a
phone), shown below a small static preview.

## 7. Spirit card (#20)

A shareable per-MP "trading card": photo, party, and 4–6 headline numbers (speeches,
absence %, spending rank, seniority, bills, top hobby) **plus a computed archetype**.

Archetype = the member's standout axis among a fixed set (each axis = their percentile rank
across the chamber on data we already have):

- Kõnemees/-naine (The Orator) — top speeches
- Kummitus (The Ghost) — top absence
- Töömesilane (The Workhorse) — top bills
- Kulukas (The Spender) — top expenses
- Vanameister (The Veteran) — top seniority
- …fallback: their strongest hobby-derived flavour

Pick the axis where the member ranks highest (ties → priority order). Pure derived label from
existing columns; no new data beyond the CV bundle. Rendered on each member profile page and
collected in a `/statistika/kaardid` gallery. Card is a self-contained component → trivially
screenshot-shareable (civic dashboards spread by sharing).

## 8. Phasing

| Phase | Ships | Needs |
|-------|-------|-------|
| **0** | New `/statistika/varia` hub + nav link + Ghost-MP + Generational + Signature words | no scrape; existing tables + `0024` |
| **1** | The `profiles` scrape → hobbies, professions, universities, languages, honours, children, birthplace, workhorse, friendship map, cause caucuses | `profiles` scrape + `--tag` LLM pass (committed `profile_tags.json`) + town coords + `0023` |
| **2** | Spirit card + gallery + cause-caucus force graph polish | composite of 0+1 |

Phase 0 is pure web + one precompute, all under the new `/statistika/varia` subtree (existing
pages untouched) — fastest visible payoff and zero scraping risk. Phase 1
is a single scrape that unlocks the entire biographical block at once. Phase 2 is the capstone.

## 9. Offline reproducibility & refresh

- `profiles` HTML archived gzip under `cache/profiles/`; `rebuild` replays it (no network),
  exactly like `ariregister`/`verbatim`. The LLM tag map (`profile_tags.json`) is committed
  alongside it, so `rebuild`/CI never call an LLM — the LLM runs only on `profiles --tag`.
- `signature_terms` recomputed in the `verbatims` path (when new stenograms land) and in
  `rebuild`.
- CV data changes rarely (bios update slowly); `profiles` runs occasionally (monthly cron or
  manual `--refresh`), not in the daily vote cron. Cheap and polite.
- Pages `revalidate = 86400`; no per-request DB fan-out.

## 10. Testing

Following the repo's offline-fixture convention:

- `profile_parse` unit tests against 2–3 committed fixture HTML pages (one with children +
  honours + doctorate, one minimal, one non-attached) — asserts every extracted field and the
  dictionary tagging (incl. an untagged long-tail value falling through to raw).
- Tagging: `UNIVERSITIES` dictionary total on fixtures; and the writer's raw→tag join through
  a fixture `profile_tags.json` maps known phrases and sends an unknown phrase to "Muu" with a
  log line (assert the log, not a silent drop). The LLM step itself isn't unit-tested (its
  output is the committed artifact); a tiny golden-file check guards the JSON shape.
- Birthplace `town → (lat,lon)` lookup: assert every fixture town resolves (fail loudly on a
  miss so new towns get added, not silently dropped).
- Signature-term precompute: a small deterministic TF-IDF check on a toy corpus.
- Web: extend the existing `lib/*.test.ts` pattern for any new sort/derive helpers (spirit
  archetype selection, diversity metric).

## 11. Open questions / deferred

- Full bills+sponsors ingest (co-sponsor network, bill success rate) — deferred to v0.6; the
  `bills`/`volumes` table is already earmarked there. Workhorse upgrades to a real graph then.
- Follower counts for the social-media stat would need off-site APIs (X/Meta) — out of scope;
  we only note presence/handles.
- Languages are inconsistently listed on profiles; the polyglot stat degrades gracefully
  (members with no listed languages are excluded, noted in the empty state — no silent cap).
- If any by-party `GROUP BY` proves slow at request time, promote to a matview (ceiling noted;
  not pre-built).
