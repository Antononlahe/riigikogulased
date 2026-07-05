# Statistika Varia (fun stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate, mobile-first `/statistika/varia` statistics hub with demographic, biographical and behavioural "fun stats" about Riigikogu members.

**Architecture:** The Python scraper writes; the Next.js web app reads (unchanged). Phase 0 stats reuse existing tables (`ballots`, `members`, `member_speeches`) plus one precomputed table. Phase 1 adds a single one-time `profiles` HTML scrape (gzip-cached, offline-reproducible like `ariregister`/`verbatim`) that fills the biographical tables, with hobby/profession tags assigned by a one-time offline LLM pass committed as JSON. Phase 2 is the composite spirit card. Every new route is statically rendered (`revalidate = 86400`) and lives under `/statistika/varia/*`; the existing `/statistika`, `/statistika/kulud`, `/statistika/otsustavad` pages are untouched.

**Tech Stack:** Python 3 (typer CLI, httpx, selectolax/BeautifulSoup for HTML, EstNLTK already present), Postgres (Neon), Next.js App Router + Tailwind + next-intl, visx/D3 (already deps), `pg` node driver.

## Global Constraints

- **Spec of record:** `statistics_implementation_plan.md` (repo root). This plan implements it.
- **No defection/discipline in any varia stat.** Overall defection is near-zero; it carries no signal. Do not join to `member_discipline`/`member_vote_alignment`/`ballot_alignment`.
- **All new DB objects are additive.** No existing view or table is altered. No discipline/alignment view is touched.
- **Offline-reproducible.** Every ingest archives raw bytes to a git-committed cache; `rebuild` replays with no network. The LLM tag pass runs only via `profiles --tag`; its output (`profile_tags.json`) is committed and read by everything else.
- **Party palette tokens:** RE, EKRE, KE, E200, SDE, I (via `@/lib/party` `partyToken`/`PartyBadge`).
- **i18n:** all UI strings via next-intl; `et` is the default locale; add keys to both `apps/web/messages/et.json` and `apps/web/messages/en.json`. Estonian domain words stay Estonian (fraktsioon, huvialad, …).
- **No emoji** in code, commits, or docs.
- **Routes:** everything new under `/statistika/varia/*`. Static render, `revalidate = 86400`, no `searchParams`.
- **Web deps:** pnpm only, from `apps/web` (`corepack pnpm -C apps/web …`). Never npm.
- **Prod migrations & prod scrapes are user-gated** (destructive-write classifier). The plan's DB-apply / live-scrape steps are run by the user; tasks are written so code + tests land first and the apply/scrape step is called out explicitly.
- **Commit style:** conventional commits; end message with the Co-Authored-By trailer. Work on a feature branch (not `main`).

---

## File Structure

**Phase 0 (web + one precompute):**
- `packages/db/migrations/0024_signature_terms.sql` — precomputed distinctive-lemma table.
- `apps/scraper/src/parteidistsipliin_scraper/signature.py` — TF-IDF precompute over `member_speeches`.
- `apps/scraper/tests/test_signature.py` — precompute unit test.
- CLI: add `signatures` command to `cli.py`.
- `apps/web/lib/varia-queries.ts` — all read queries for varia (ghost-MP, generational, signature words; grows in later phases).
- `apps/web/lib/varia.ts` — pure helpers + shared row types + unit-testable logic (sorting, generation bucketing, archetype).
- `apps/web/lib/varia.test.ts` — helper unit tests.
- `apps/web/app/[locale]/statistika/varia/page.tsx` — hub landing.
- `apps/web/app/[locale]/statistika/varia/kohalolek/page.tsx` — ghost-MP.
- `apps/web/app/[locale]/statistika/varia/polvkonnad/page.tsx` — generational.
- `apps/web/app/[locale]/statistika/varia/margusonad/page.tsx` — signature words.
- `apps/web/components/varia/varia-hub.tsx`, `absence-leaderboard.tsx`, `generations.tsx`, `signature-words.tsx`.
- Modify `apps/web/components/site-header.tsx` (add Varia nav link).
- Modify `apps/web/messages/{et,en}.json` (add `varia` namespace).

**Phase 1 (profiles scrape):**
- `apps/scraper/src/parteidistsipliin_scraper/profile_cache.py` — gzip HTML cache (mirror `verbatim_cache.py`).
- `apps/scraper/src/parteidistsipliin_scraper/profile_parse.py` — HTML → structured `ProfileData`.
- `apps/scraper/src/parteidistsipliin_scraper/profile_tags.py` — `UNIVERSITIES` dict + tag taxonomy + LLM tagging entrypoint + committed-JSON loader.
- `apps/scraper/src/parteidistsipliin_scraper/towns.py` — `TOWN_COORDS` lookup (town → lat/lon).
- CLI: add `profiles` command (`--refresh`, `--tag`).
- `packages/db/migrations/0023_member_profiles.sql` — profile tables.
- `apps/scraper/cache/profiles/*.html.gz`, `apps/scraper/cache/profiles/profile_tags.json` (committed).
- `apps/scraper/fixtures/profiles/*.html` (2–3 committed fixtures), `apps/scraper/tests/test_profile_parse.py`.
- Web: `apps/web/app/[locale]/statistika/varia/inimesed/page.tsx`, `.../vorgustik/page.tsx` + components; extend `varia-queries.ts`/`varia.ts`.
- Static assets: `apps/web/public/varia/estonia.svg` (public-domain outline).

**Phase 2 (spirit card):**
- `apps/web/lib/spirit.ts` + `spirit.test.ts` — archetype selection from percentile ranks.
- `apps/web/components/varia/spirit-card.tsx`.
- `apps/web/app/[locale]/statistika/varia/kaardid/page.tsx` (gallery) + render on member profile page.

---

# PHASE 0 — hub + reused-data stats (no scraping)

## Task 0: Feature branch

- [ ] **Step 1: Create branch off main's PR base**

Run:
```bash
git checkout -b feat/statistika-varia
```
Expected: `Switched to a new branch 'feat/statistika-varia'`

- [ ] **Step 2: Commit the spec + this plan (already written)**

```bash
git add statistics_implementation_plan.md docs/superpowers/plans/2026-07-05-statistika-varia.md
git commit -m "docs: statistika varia spec + implementation plan"
```

---

## Task 1: Ghost-MP query + helpers

**Files:**
- Create: `apps/web/lib/varia.ts`
- Create: `apps/web/lib/varia.test.ts`
- Create: `apps/web/lib/varia-queries.ts`

**Interfaces:**
- Produces: `type AbsenceRow = { memberId:number; fullName:string; slug:string; partyShortName:string|null; photoThumbPath:string|null; active:boolean; total:number; absent:number; absentPct:number }`
- Produces: `getAbsenceLeaderboard(): Promise<AbsenceRow[]>`
- Produces: `sortAbsence(rows:AbsenceRow[], dir:'asc'|'desc'): AbsenceRow[]`

Absence = share of that member's ballots where `choice='absent'`, over **non-procedural** votes only (procedural presence-checks would swamp it). Denominator = ballots on non-procedural votes; numerator = those with `choice='absent'`.

- [ ] **Step 1: Write the failing helper test**

`apps/web/lib/varia.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sortAbsence, type AbsenceRow } from "./varia";

const row = (o: Partial<AbsenceRow>): AbsenceRow => ({
  memberId: 1, fullName: "A", slug: "a", partyShortName: "RE",
  photoThumbPath: null, active: true, total: 100, absent: 10, absentPct: 10, ...o,
});

describe("sortAbsence", () => {
  it("orders by absentPct desc then name asc", () => {
    const rows = [
      row({ memberId: 1, fullName: "Bee", absentPct: 5 }),
      row({ memberId: 2, fullName: "Ann", absentPct: 20 }),
      row({ memberId: 3, fullName: "Cat", absentPct: 20 }),
    ];
    expect(sortAbsence(rows, "desc").map((r) => r.memberId)).toEqual([2, 3, 1]);
  });
});
```

- [ ] **Step 2: Run it, verify fail**

Run: `corepack pnpm -C apps/web vitest run lib/varia.test.ts`
Expected: FAIL (cannot find module `./varia`).

- [ ] **Step 3: Implement `varia.ts`**

```ts
export type AbsenceRow = {
  memberId: number; fullName: string; slug: string;
  partyShortName: string | null; photoThumbPath: string | null;
  active: boolean; total: number; absent: number; absentPct: number;
};

export function sortAbsence(rows: AbsenceRow[], dir: "asc" | "desc"): AbsenceRow[] {
  const s = [...rows].sort((a, b) =>
    a.absentPct === b.absentPct
      ? a.fullName.localeCompare(b.fullName, "et")
      : a.absentPct - b.absentPct,
  );
  return dir === "desc" ? s.reverse() : s;
}
```

Note: `reverse()` after an asc sort keeps the name tiebreak ascending within an equal-pct group (see test: 2 before 3). Good.

- [ ] **Step 4: Run it, verify pass**

Run: `corepack pnpm -C apps/web vitest run lib/varia.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the query in `varia-queries.ts`**

```ts
import { unstable_cache } from "next/cache";
import { pool } from "./db";
import type { AbsenceRow } from "./varia";

export const getAbsenceLeaderboard = unstable_cache(
  _getAbsenceLeaderboard,
  ["varia-absence"],
  { revalidate: 86400 },
);

async function _getAbsenceLeaderboard(): Promise<AbsenceRow[]> {
  const { rows } = await pool.query(`
    SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS "partyShortName",
           m.photo_thumb_path AS "photoThumbPath", m.active,
           count(*)::int AS total,
           count(*) FILTER (WHERE b.choice = 'absent')::int AS absent,
           round(100.0 * count(*) FILTER (WHERE b.choice = 'absent') / count(*), 1)::float AS "absentPct"
    FROM ballots b
    JOIN votes v ON v.id = b.vote_id
    JOIN members m ON m.id = b.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE v.vote_type_slug NOT IN (SELECT slug FROM procedural_vote_types)
    GROUP BY m.id, m.full_name, m.slug, mcp.party_short_name, m.photo_thumb_path, m.active
    HAVING count(*) >= 20          -- ponytail: floor out members with too few votes to be meaningful
    ORDER BY "absentPct" DESC, m.full_name ASC
  `);
  return rows as AbsenceRow[];
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/varia.ts apps/web/lib/varia.test.ts apps/web/lib/varia-queries.ts
git commit -m "feat(varia): absence leaderboard query + sort helper"
```

---

## Task 2: Ghost-MP page + component

**Files:**
- Create: `apps/web/components/varia/absence-leaderboard.tsx`
- Create: `apps/web/app/[locale]/statistika/varia/kohalolek/page.tsx`
- Modify: `apps/web/messages/et.json`, `apps/web/messages/en.json` (add `varia` namespace keys used here)

**Interfaces:**
- Consumes: `getAbsenceLeaderboard`, `AbsenceRow`, `sortAbsence` (Task 1).

- [ ] **Step 1: Add i18n keys** to both message files under a new `"varia"` object: `hubTitle`, `hubIntro`, `absenceTitle`, `absenceIntro`, `member`, `absencePct`, `absentVotes`, `totalVotes`, `empty`, `sortAbs`, `sortRate`. (et values in Estonian, en in English. Exact copy is the implementer's; keep it laconic.)

- [ ] **Step 2: Build the component** — desktop `ScrollableTable` + mobile card list, mirroring `speaker-leaderboard.tsx`. Columns: member (avatar+badge), total votes, absent votes, absent %. Client component, `useState` sort dir on the % column, in-cell party-token bar behind the % like the speaker table. Reuse `MemberAvatar`, `PartyBadge`, `partyToken`, `Link` from `@/i18n/routing`.

- [ ] **Step 3: Build the page** (server component), mirroring `statistika/page.tsx`:

```tsx
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AbsenceLeaderboard } from "@/components/varia/absence-leaderboard";
import { getAbsenceLeaderboard } from "@/lib/varia-queries";
import type { AbsenceRow } from "@/lib/varia";

export const revalidate = 86400;

export default async function AbsencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("varia");
  let rows: AbsenceRow[] = [];
  try { rows = await getAbsenceLeaderboard(); } catch { /* empty state */ }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("absenceTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("absenceIntro")}</p>
        <div className="mt-6">
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p>
                             : <AbsenceLeaderboard rows={rows} />}
        </div>
        <SiteFooter />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Verify build + typecheck**

Run: `corepack pnpm -C apps/web build`
Expected: compiles; `/statistika/varia/kohalolek` appears in the route list. (Needs `DATABASE_URL` set for static gen; if unset, run `corepack pnpm -C apps/web lint && corepack pnpm -C apps/web exec tsc --noEmit` instead and defer full build to when the DB env is present.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/varia/absence-leaderboard.tsx apps/web/app/[locale]/statistika/varia/kohalolek apps/web/messages/et.json apps/web/messages/en.json
git commit -m "feat(varia): ghost-MP absence leaderboard page"
```

---

## Task 3: Generational blocks

**Files:**
- Modify: `apps/web/lib/varia.ts` (+ `generationOf`, types), `apps/web/lib/varia.test.ts`, `apps/web/lib/varia-queries.ts`
- Create: `apps/web/components/varia/generations.tsx`
- Create: `apps/web/app/[locale]/statistika/varia/polvkonnad/page.tsx`
- Modify: message files (keys: `generationsTitle`, `generationsIntro`, cohort labels, `avgAge`, `youngest`, `oldest`).

**Interfaces:**
- Produces: `generationOf(year:number): string` → one of `'95+' | '85-94' | '75-84' | '65-74' | '55-64' | '-54'` (matching the official `arvud-räägivad` cohorts).
- Produces: `type GenRow = { memberId:number; fullName:string; slug:string; partyShortName:string|null; photoThumbPath:string|null; birthYear:number; age:number }`
- Produces: `getMembersWithAge(): Promise<GenRow[]>` (active members with non-null `date_of_birth`).

- [ ] **Step 1: Failing test for `generationOf`**

Add to `varia.test.ts`:
```ts
import { generationOf } from "./varia";
describe("generationOf", () => {
  it("buckets by birth year", () => {
    expect(generationOf(1996)).toBe("95+");
    expect(generationOf(1979)).toBe("75-84");
    expect(generationOf(1950)).toBe("-54");
  });
});
```

- [ ] **Step 2: Run, verify fail.** `corepack pnpm -C apps/web vitest run lib/varia.test.ts` → FAIL.

- [ ] **Step 3: Implement `generationOf`** in `varia.ts`:
```ts
export function generationOf(year: number): string {
  if (year >= 1995) return "95+";
  if (year >= 1985) return "85-94";
  if (year >= 1975) return "75-84";
  if (year >= 1965) return "65-74";
  if (year >= 1955) return "55-64";
  return "-54";
}
```

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: Query** in `varia-queries.ts` (cached, 86400): select active members with `date_of_birth IS NOT NULL`, computing `extract(year from date_of_birth)::int AS "birthYear"` and `date_part('year', age(date_of_birth))::int AS age`, joined to `member_current_party`. Return `GenRow[]`.

- [ ] **Step 6: Component** `generations.tsx`: stacked cohort bars per party (cohort share within each party) using party tokens, plus three callouts: youngest MP, oldest MP, chamber average age. Mobile = same bars stacked full-width + callout chips. Compute the aggregation in the component from `GenRow[]` (pure, no chart lib needed — fl<div> bars).

- [ ] **Step 7: Page** `polvkonnad/page.tsx` — same shell as Task 2.

- [ ] **Step 8: Typecheck/build, then commit** `feat(varia): generational blocks page`.

---

## Task 4: Signature-terms migration

**Files:**
- Create: `packages/db/migrations/0024_signature_terms.sql`

- [ ] **Step 1: Write the migration**

```sql
-- packages/db/migrations/0024_signature_terms.sql
-- Precomputed "signature words": the most distinctive lemmas for each member and each party,
-- by TF-IDF over member_speeches.lemmas. A cache like ballot_alignment/member_expenses: the
-- web reads top-N per scope instead of running TF-IDF per request. Recomputed by the
-- `signatures` CLI (offline, from member_speeches) and in rebuild. Additive; no view touched.
BEGIN;

CREATE TABLE IF NOT EXISTS signature_terms (
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('member','party')),
  scope_id   INT  NOT NULL,          -- members.id or parties.id
  lemma      TEXT NOT NULL,
  score      REAL NOT NULL,          -- tf-idf weight
  rank       INT  NOT NULL,          -- 1..N within the scope, by score desc
  PRIMARY KEY (scope_kind, scope_id, lemma)
);
CREATE INDEX IF NOT EXISTS signature_terms_scope_idx
  ON signature_terms (scope_kind, scope_id, rank);

COMMIT;
```

- [ ] **Step 2: Commit** `feat(db): 0024 signature_terms cache table`.
  (Apply-to-prod is a later, user-gated step — see Task 6.)

---

## Task 5: Signature-terms precompute (Python)

**Files:**
- Create: `apps/scraper/src/parteidistsipliin_scraper/signature.py`
- Create: `apps/scraper/tests/test_signature.py`
- Modify: `apps/scraper/src/parteidistsipliin_scraper/cli.py` (add `signatures` command)
- Modify: `apps/scraper/src/parteidistsipliin_scraper/db.py` (add `replace_signature_terms`)

**Interfaces:**
- Produces: `compute_signature_terms(docs: dict[int, str], top_n: int = 25) -> list[tuple[int, str, float, int]]` — pure TF-IDF over `{scope_id: joined_lemmas}`, returns `(scope_id, lemma, score, rank)` rows. Stopword-filtered, min doc-frequency floor.
- Produces: CLI `signatures` — builds member-scope docs (one per member from `member_speeches.lemmas`) and party-scope docs (concatenated by current party), computes both, and replaces `signature_terms`.

- [ ] **Step 1: Failing unit test**

`apps/scraper/tests/test_signature.py`:
```python
from parteidistsipliin_scraper.signature import compute_signature_terms

def test_distinctive_lemma_ranks_first():
    # 'kala' appears only in doc 1 -> distinctive there; 'ja' is everywhere -> not distinctive.
    docs = {
        1: "kala kala ja ja vesi",
        2: "auto auto ja ja tee",
        3: "maja maja ja ja aed",
    }
    rows = compute_signature_terms(docs, top_n=3)
    top1 = [(lemma, rank) for sid, lemma, score, rank in rows if sid == 1 and rank == 1]
    assert top1 == [("kala", 1)]
    # the ubiquitous 'ja' never wins a top slot
    assert all(lemma != "ja" for sid, lemma, score, rank in rows if rank == 1)
```

- [ ] **Step 2: Run, verify fail.** `apps/scraper/.venv/Scripts/python -m pytest apps/scraper/tests/test_signature.py -q` → FAIL (module missing).

- [ ] **Step 3: Implement `signature.py`** — plain TF-IDF: term freq per doc × `log(N / df)`, drop terms with `df == N` (in every doc) and single-char / numeric tokens and a small Estonian stopword set, take top-N by score per doc, assign 1-based rank. No sklearn; a dict-based implementation (~30 lines). ponytail: naive in-memory TF-IDF over ~101 docs is fine; note the ceiling (recompute is O(total tokens), runs offline).

- [ ] **Step 4: Run, verify pass.**

- [ ] **Step 5: `db.replace_signature_terms(conn, rows)`** — `TRUNCATE signature_terms` then batch `execute_values` insert (batched, not per-row — see the repo's batch-writes rule). Add `signatures` command to `cli.py` that reads `member_speeches` grouped by member and by current party, calls `compute_signature_terms` for each scope kind, and writes both. Wire a `signatures` refresh into `rebuild` and the `verbatims` path (after new stenograms).

- [ ] **Step 6: Commit** `feat(scraper): signature-terms TF-IDF precompute + CLI`.

---

## Task 6: Apply 0024 + populate signatures (USER-GATED)

**This task is executed by the user** (prod DB write). The agent prepares the exact commands and hands off.

- [ ] **Step 1: Apply migration 0024 to prod** via the `migrate` CLI (`apply_migrations`), per CLAUDE.md. Command:
  `apps/scraper/.venv/Scripts/python -m parteidistsipliin_scraper migrate`
- [ ] **Step 2: Populate** `apps/scraper/.venv/Scripts/python -m parteidistsipliin_scraper signatures`
- [ ] **Step 3: Sanity check** `SELECT scope_kind, count(*) FROM signature_terms GROUP BY 1;` — expect member + party rows.

---

## Task 7: Signature-words page

**Files:**
- Modify: `apps/web/lib/varia-queries.ts` (+ `getPartySignatureWords`), `apps/web/lib/varia.ts` (+ type)
- Create: `apps/web/components/varia/signature-words.tsx`
- Create: `apps/web/app/[locale]/statistika/varia/margusonad/page.tsx`
- Modify: message files.

**Interfaces:**
- Produces: `type PartyWords = { partyShortName:string; words:{lemma:string; score:number; rank:number}[] }`
- Produces: `getPartySignatureWords(): Promise<PartyWords[]>` — reads `signature_terms` where `scope_kind='party'` joined to `parties`, top 15 per party by rank.

- [ ] **Step 1: Query** — join `signature_terms` (party scope) → `parties.short_name`, order by rank, cap 15/party. Cached 86400.
- [ ] **Step 2: Component** — one card per party; word chips sized by score (font-size scaled between min/max), party-token accent. Mobile = stacked cards, wrapped chips. (Also expose a per-member variant later on the member profile page — out of Phase 0 scope; noted.)
- [ ] **Step 3: Page** shell as before; empty state when `signature_terms` is empty (pre-Task-6).
- [ ] **Step 4: Typecheck/build; commit** `feat(varia): party signature-words page`.

---

## Task 8: Varia hub + nav link

**Files:**
- Create: `apps/web/components/varia/varia-hub.tsx`
- Create: `apps/web/app/[locale]/statistika/varia/page.tsx`
- Modify: `apps/web/components/site-header.tsx`, message files.

**Interfaces:**
- Consumes: nothing new; the hub links to the sub-routes and may show a live headline number per tile via small cached queries (optional; can start static).

- [ ] **Step 1: Nav** — add one link in `site-header.tsx` after the decisive link:
```tsx
<Link href="/statistika/varia" className="hover:text-foreground">{nav("varia")}</Link>
```
and add `"varia"` to the `nav` namespace in both message files.

- [ ] **Step 2: Hub component** — responsive card grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`), one tile per available stat (Phase 0: Kohalolek, Põlvkonnad, Märgusõnad; later phases add Inimesed, Võrgustik, Kaardid). Each tile: title, one-line teaser, `Link` to its route. Tiles for not-yet-built routes are omitted until their task lands (no dead links).
- [ ] **Step 3: Page** — server component shell; renders `<VariaHub/>` under an `h1` (`t("hubTitle")`) + intro.
- [ ] **Step 4: Typecheck/build; commit** `feat(varia): hub landing + nav link`.

- [ ] **Step 5: PHASE 0 GATE** — request code review (superpowers:requesting-code-review) of the varia subtree, then open a PR against `claude/clever-noether-ch7018`. Confirm the three Phase-0 pages render against prod data (kohalolek + polvkonnad work immediately; margusonad after Task 6).

---

# PHASE 1 — the `profiles` scrape (biographical stats)

> Parser selectors are pinned against **captured fixtures** (Task 9) — not written blind here. Each parse task's test asserts against a committed real page saved during Task 9. This is why Phase 1 starts by capturing fixtures.

## Task 9: Capture profile fixtures + cache scaffold

**Files:**
- Create: `apps/scraper/src/parteidistsipliin_scraper/profile_cache.py` (mirror `verbatim_cache.py`: gzip read/write under `cache/profiles/<uuid>.html.gz`).
- Create: `apps/scraper/fixtures/profiles/{alender,minimal,nonattached}.html` (3 real pages saved verbatim).
- Modify: `cli.py` (add `profiles` command skeleton that fetches each member profile via a throttled client and writes the gzip cache).

- [ ] **Step 1:** Implement `ProfileCache` (gzip, same shape as `AriregisterCache`/`VerbatimCache`).
- [ ] **Step 2:** Add `profiles` command that iterates `members.riigikogu_id`, builds the profile URL, fetches at 1 req/s (reuse the existing throttled client), and writes `<uuid>.html.gz`. Guard with `--refresh`.
- [ ] **Step 3 (USER-GATED live fetch):** run `profiles` once to populate the cache. Then copy 3 representative pages into `fixtures/profiles/` (one with children+honours+doctorate, one sparse, one non-attached).
- [ ] **Step 4:** Commit the cache + fixtures (`chore(scraper): profile HTML cache + fixtures`).

## Task 10: `profile_parse` — bio core

**Files:** `profile_parse.py`, `apps/scraper/tests/test_profile_parse.py`.
**Interfaces:** Produces `parse_profile(html:str) -> ProfileData` where `ProfileData` (dataclass) has: `birthplace_town:str|None`, `children_count:int|None`, `family_status_raw:str|None`, `education:list[Education]`, `career:list[Career]`, `hobbies_raw:list[str]`, `languages:list[str]`, `honours_raw:list[str]`, `bills_initiated:int`, `bills_led:int`, `friendship_groups:list[str]`, `cause_groups:list[str]`, `social:dict[str,str]`.

- [ ] TDD each field against the fixtures: write the assert (e.g. Alender → `children_count == 4`, `"arhitektuur" in hobbies_raw`, `bills_led == 3`), run-fail, implement the selector, run-pass. One field group per commit. Use selectolax (add dep via uv) or stdlib `html.parser` if a dep is unwanted — decide at Step 1 by checking existing scraper deps; prefer an already-present parser.

## Task 11: Universities dict + towns lookup

**Files:** `profile_tags.py` (`UNIVERSITIES` + `canonical_university(raw)`), `towns.py` (`TOWN_COORDS`, `coords_for(town)`), tests.
- [ ] TDD `canonical_university`: fixture education strings → canonical names; unknown → `None` (kept raw). `TOWN_COORDS`: every fixture birthplace resolves; unknown raises (fail-loud). Commit.

## Task 12: LLM tag pass + committed JSON

**Files:** `profile_tags.py` (taxonomy constants `HOBBY_TAGS`, `PROFESSION_TAGS`; `tag_phrases(raws, taxonomy) -> dict[str,str]` calling the LLM; `load_tag_map()` reading committed JSON), `cli.py` (`profiles --tag`).
**Interfaces:** Produces `cache/profiles/profile_tags.json` = `{"hobby": {raw: tag}, "profession": {raw: tag}}`.
- [ ] **Step 1:** Define the fixed taxonomies (committed lists).
- [ ] **Step 2:** `profiles --tag` collects all distinct hobby/profession raws from the cache, sends them to the LLM with the taxonomy (one call per field, strict "assign each to exactly one existing tag or 'Muu'"), writes the JSON. Deterministic re-runs only add new phrases.
- [ ] **Step 3:** `load_tag_map()` + a golden-file shape test. The writer maps raw→tag through this JSON (never calls the LLM). Commit the JSON.

## Task 13: Migration 0023 + writer + wire-up

**Files:** `packages/db/migrations/0023_member_profiles.sql` (tables from spec §5), `db.py` (`upsert_profiles`), `writer.py` (map `ProfileData`+tag map+coords → rows), `cli.py` (`profiles` now also writes DB), `rebuild` (replay profiles cache).
- [ ] TDD the writer mapping against a fixture `ProfileData` → expected row dicts (batched insert). Apply 0023 + run `profiles` write = **USER-GATED** (mirror Task 6). Commit code; hand off apply/populate.

## Task 14: `inimesed` page (CV bundle)

**Files:** `varia-queries.ts` (+ rollup queries: hobby-by-party, profession diversity, university league, languages, honours, children, birthplace pins), `varia.ts` (+ diversity metric helper + test), `components/varia/*` (one section component each), `app/.../inimesed/page.tsx`, `public/varia/estonia.svg`.
- [ ] Build section-by-section (each its own commit): hobby cloud + by-party small-multiples; profession diversity bars (distinct-tags/members, TDD the metric); university league table; polyglot bars; honours wall; baby-count bars; birthplace **town pins** on the Estonia SVG (project lat/lon to viewBox; count-sized dots; tap → member list; mobile list fallback). In-page anchored sub-nav chips. Each section degrades to an empty state.

## Task 15: `vorgustik` page (friendship + caucuses)

**Files:** `varia-queries.ts` (+ friendship country popularity, globetrotter leaderboard, cause-caucus edges), `components/varia/network.tsx` (visx/D3 force graph desktop + list fallback mobile), `app/.../vorgustik/page.tsx`.
- [ ] Friendship: country-popularity bars + "most groups" leaderboard. Caucuses: cross-party force graph (members↔causes) on desktop, per-cause member-chip list on mobile (a force graph is unreadable on a phone — render the list below a small static preview). Add the tiles to the hub. Commit per section.

## Task 16: PHASE 1 GATE
- [ ] Code review + PR update; confirm `inimesed` + `vorgustik` render against populated prod data.

---

# PHASE 2 — spirit card

## Task 17: Archetype logic
**Files:** `apps/web/lib/spirit.ts`, `spirit.test.ts`.
**Interfaces:** Produces `pickArchetype(percentiles: {speeches:number; absence:number; bills:number; spend:number; seniority:number}) -> ArchetypeKey` — returns the axis with the highest percentile, ties broken by a fixed priority order.
- [ ] TDD: a member top on absence → `"ghost"`; all-average → fallback; tie → priority order. Implement (pure). Commit.

## Task 18: Spirit-card component + gallery + profile embed
**Files:** `components/varia/spirit-card.tsx`, `app/.../kaardid/page.tsx`, modify member profile page to embed the card.
- [ ] `varia-queries.ts`: `getSpiritData()` assembling per-member percentiles (from existing speech/absence/bills/expense/seniority data) + top hobby. Render a self-contained shareable card (photo, party, 4–6 stats, archetype label + its et/en copy). Gallery route lists all cards; the member profile page embeds each member's own. Add the hub tile. Commit per piece.
- [ ] PHASE 2 GATE: review + PR update.

---

## Self-Review notes (coverage against spec)

- Spec §1 features 1,2,3,4,5,6,7,8,9,12,13,14,19,20 → Tasks: 13/19/12 (Phase 0: kohalolek=#13, polvkonnad=#19, margusonad=#12); Task 14 (#1,2,3,4,5,6,7,14); Task 15 (#8,9); Tasks 17–18 (#20). #2b (words-by-profession) folds into Task 14's profession cohort × Task 7 signature data — flagged as an optional facet, deferred if it bloats Task 14.
- Spec §2 decisions honoured: LLM tagging (Task 12, committed JSON), workhorse counts (Task 10/13), town pins (Tasks 11/14), stat-sheet+archetype (Tasks 17–18).
- Spec §9 reproducibility: caches committed; `rebuild` replays; LLM only in `--tag` (Tasks 9,12,13).
- Spec §10 testing: parse fixtures (10), tag totality (11–12), town resolution (11), TF-IDF (5), helpers (1,3,17).
- Known deferrals kept as deferrals: full bills+sponsors (v0.6), social follower counts (out), per-member signature words (noted in Task 7).
