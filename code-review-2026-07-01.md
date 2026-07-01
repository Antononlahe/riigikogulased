# Parteidistsipliin — Consolidated Audit Report

_Whole-repo review, 2026-07-01. 7 focused auditors (F1 scoring, F2 ingestion, F3 web-data,
F4 ui/i18n/a11y, E1 migrations, E2 tests, E3 over-engineering) + adversarial verify + synthesis._

## Executive summary

The codebase is in good shape: seven independent auditors surfaced **no Critical and no High
findings**. The core discipline-scoring logic (F1) came back completely clean, and the SQL
scoring views were not implicated in any finding. What remains is a cluster of medium-severity
**durability/parity/coverage** issues plus a long tail of low-severity a11y, perf, and DRY
polish. Fix these three first: (1) the **migration atomicity hazard** that can permanently
wedge the prod migration chain on Neon (E1); (2) the **offline `rebuild` silently dropping
`draft_outcomes`**, which breaks the repo's "rebuild reproduces the DB with no network"
guarantee (F2); and (3) the **zero test coverage on the chronological faction-term build** —
the single most correctness-critical untested path (E2). The web data layer, i18n, and scoring
subsystems are otherwise healthy; most web findings are low-severity a11y attributes and
micro-optimizations masked by ISR.

_Note: no finding was rated High/Critical, so the adversarial refute pass ran on zero findings;
the medium/low tier below reflects single-auditor confidence, not independent verification._

---

## Critical

_None._

## High

_None._

## Medium

**Offline `rebuild` never populates `draft_outcomes` despite the source JSON being cached**
`apps/scraper/src/parteidistsipliin_scraper/cli.py:174-179` (F2)
The eurovoc rebuild loop calls `write_volume_topics` but never `_write_draft_outcome`, so after
a from-cache rebuild `draft_outcomes` (migration `0009`) is left empty — and the member-detail
vote timeline LEFT JOINs it (`apps/web/lib/queries.ts:169`), silently dropping every bill's
adopted/rejected status even though the raw draft JSON is committed under `cache/api/drafts/`.
Fix: inside the `if raw:` branch add `_write_draft_outcome(conn, draft_uuid, raw)` before
parsing descriptors, mirroring `_ingest_draft_topics` (both symbols are already imported in
this module).

**Migration body and `schema_migrations` bookkeeping commit in two separate transactions, risking a permanently wedged chain**
`apps/scraper/src/parteidistsipliin_scraper/db.py:210-219` (E1)
Each migration file self-`COMMIT`s its DDL, then a separate statement inserts the version row
and commits — two transactions. A connection drop between them (realistic on the Neon pooler)
leaves a migration applied-but-unrecorded; the next run re-executes non-idempotent bodies
(`0003`'s `RENAME TO member_faction_terms`, `0014`'s `DROP EXPRESSION`) which then error and
block every later migration. Fix: drop the `BEGIN;`/`COMMIT;` wrappers from the SQL files
(matching `0017/0018/0021`) and let `apply_migrations` own one transaction per migration that
includes the version `INSERT` before a single `conn.commit()`; alternatively guard each
non-idempotent body.

**Chronological faction-term build (`write_voting` + `set_member_faction`) has zero test coverage**
`apps/scraper/src/parteidistsipliin_scraper/writer.py:88-98` and `db.py:64-89` (E2)
`member_faction_terms` is the source of truth for faction-at-time scoring and is built by
closing the open term (`ended_on = started_on`) then opening a new one — correctness hinges
entirely on votings arriving in ascending `startDateTime` order, yet no test touches this path
(no test opens a DB connection at all). Out-of-order ingestion would set `ended_on < started_on`
and silently corrupt every switch date. Fix: add `test_writer.py` driving `write_voting`
against a real/gated test DB with two votings that change `voters[].faction`, asserting
`term1.ended_on == day2.started_on` and `term2` open; add a negative out-of-order case to pin
the ascending-order contract.

**`ApiClient` backoff-exhaustion and non-retryable-status branches are untested; sleep is not injectable**
`apps/scraper/src/parteidistsipliin_scraper/api_client.py:87-90` (E2)
Three risky `_get` branches are never exercised: an immediate raise on a non-retryable status
(500/404 must not retry), `raise last_exc` after 5 transport failures, and `raise RuntimeError`
after 5 retryable statuses. They're untested because `asyncio.sleep(2**attempt)` is hard-coded,
so an exhaustion test would really sleep ~31s. Fix: monkeypatch `asyncio.sleep`, then assert a
persistent 500 raises immediately (one call, no retry), five 429s raise `RuntimeError`, and
five `ConnectTimeout`s re-raise the last one — this also removes the real ~1s sleeps from the
existing retry tests.

**`election_parse` is never run against the committed real `RK_2023` fixture, and its error branches are untested**
`apps/scraper/tests/test_election_parse.py` (whole file); branches at
`election_parse.py:57-61,75-79,97,111,115` (E2)
The real 516KB/626KB RIA XML is git-tracked under `cache/election/RK_2023/` with an
`ElectionCache` replayer, yet every test parses tiny inline snippets — so any divergence from
the real RIA schema (namespaces, missing fields, malformed dates) goes undetected, defeating
the offline-parity guarantee. Drop-to-`None` branches (`_dob_from_birthday`, `_int_or_none`,
unknown `mandate_type`, `DISTRICT` mandate) are also unreachable from the inline fixture. Fix:
add a test that parses the committed XML via `ElectionCache` asserting real-schema invariants
(~101 elected, every mandate in `MANDATE_TYPES`, ISO-or-None DOBs), plus unit cases for the
malformed/empty/unknown inputs.

## Low

**`AriregisterClient` does not retry bare transport errors despite claiming ApiClient parity**
`apps/scraper/src/parteidistsipliin_scraper/ariregister_client.py:53-64` (F2)
`_get` retries only on status 429/502/503/504, not on `httpx.RequestError`, contradicting the
docstring's "Same throttle/backoff discipline as ApiClient" (`api_client.py:70-81` was hardened
for exactly this). A transient hiccup during `erakond` aborts the run; impact is limited because
the command is manual and cache-first. Fix: wrap the `get` call in `try/except
httpx.RequestError`, record it, sleep `2**attempt`, continue, and raise the last exception after
the loop (or share one retry helper — see Cut list).

**Speech-stats rows written during `rebuild` diverge from live ingest (`period_end`, `fetched_at`)**
`apps/scraper/src/parteidistsipliin_scraper/cli.py:189` (F2)
`rebuild` passes `period_end=None` while `_refresh_speeches` writes `date.today()`
(`cli.py:520`), and `upsert_speech_stats` stamps `fetched_at=now()` (`db.py:687`) — so the same
cached snapshot yields a NULL vs dated window-end and a non-reproducible timestamp. Counts are
deterministic, so only metadata differs. Fix: store the window end alongside the cached snapshot
and replay it; pass an explicit deterministic `fetched_at` for rebuild-sourced rows if strict
parity is required.

**Member detail page stacks 3 sequential round-trips after `getMemberDetail` (cold-render waterfall)**
`apps/web/app/[locale]/members/[slug]/page.tsx:40,51,59,67` (F3)
`getMemberDetail` deliberately parallelizes its 8 internal queries, but the page then awaits
`getMemberSpeechStats`, `getMemberElection`, and `getMemberExpenses` strictly sequentially even
though they're mutually independent — three stacked Neon round-trips on every ISR cache miss.
Fix: `const [speechStats, election, expenses] = await Promise.allSettled([...])` and unwrap each
to `null`/`[]` on rejection to preserve the graceful-degradation semantics.

**`member_speeches` word totals re-tokenize text live instead of using the stored `word_count` column (0021)**
`apps/web/lib/speeches-queries.ts:59,108` (F3)
Migration `0021` added a STORED `word_count` column so callers stop re-tokenizing, and
`getSpeechLeaderboard` was updated — but `getMemberSpeechMeta` (line 59) and
`browseMemberSpeeches` (line 108) still compute `array_length(string_to_array(btrim(text),'
'),1)` at query time. Values are byte-identical, so this is perf/consistency only. Fix: use
`coalesce(sum(word_count),0)::int` and `word_count AS "wordCount"` respectively (`avgWords`
follows automatically).

**Active statistika tab and year selector convey state by color only (no `aria-current`)**
`apps/web/components/statistika/statistika-tabs.tsx:15-20` (F4)
The active tab and active year link are signaled solely by the `bg-foreground text-background`
class swap, with no programmatic current-state marker (WCAG 1.4.1 / 4.1.2); a repo-wide grep
found zero `aria-current`. Links are the correct semantic choice here. Fix: add
`aria-current={active === "kone" ? "page" : undefined}` to each tab `Link`, and
`aria-current={y === year ? "page" : undefined}` to each year `Link` in
`expenses-section.tsx:21-32`.

**Abs / Per-month toggle buttons lack `aria-pressed` (active state color-only)**
`apps/web/components/statistika/speaker-leaderboard.tsx:76-83` (F4)
The two mode `<button>`s express selection only via `bg-foreground text-background` vs `bg-card
text-muted-foreground`; `aria-pressed` appears nowhere in `apps/web`, so AT users can't perceive
the active mode. Fix: add `aria-pressed={mode === m}` to the toggle button, optionally wrapping
both in a `role="group"` with an aria-label.

**Data tables omit `scope` on `<th>` and use `<td>` for the row-identifying cell**
`apps/web/components/statistika/expense-leaderboard.tsx:86-102,114` (F4)
Column headers lack `scope="col"` and the member-identity cell is a `<td>` rather than `<th
scope="row">`; the same shape recurs in `speaker-leaderboard.tsx` and `members-table.tsx`
(repo-wide grep: zero `scope=`). Missing row headers degrade screen-reader navigation across
numeric cells. Fix: add `scope="col"` to header cells and promote the first body cell to `<th
scope="row">` (add `font-normal text-left` to neutralize default `<th>` styling); apply across
all three tables.

**`0021` adds `word_count` without `IF NOT EXISTS`, breaking the repo's re-runnability convention**
`packages/db/migrations/0021_speech_word_count.sql:8` (E1)
Every other column-adding migration (`0002/0004/0013/0016/0018`) guards with `ADD COLUMN IF NOT
EXISTS`; `0021` doesn't, so re-applying against a DB that already has the column (e.g. a rebuild
onto a reset `schema_migrations`) fails and halts the run. Fix: `ADD COLUMN IF NOT EXISTS
word_count int GENERATED ALWAYS AS (...) STORED;`.

**`ballot_alignment` is refreshed where nothing changed, always under an ACCESS EXCLUSIVE lock**
`apps/scraper/src/parteidistsipliin_scraper/cli.py:236` (also `cli.py:71`, `db.py:229`) (E1)
`refresh_alignment` runs a plain non-concurrent `REFRESH MATERIALIZED VIEW` (~8s ACCESS
EXCLUSIVE lock) that blocks all core reads. Two call sites refresh needlessly: `_refresh_members`
(`write_member` never sets faction and isn't a `member_vote_alignment` input) and
`_scrape_range`, which refreshes even on the common zero-new-votings `daily` cron day. Fix: drop
the refresh from `_refresh_members`; guard `_scrape_range` with `if n: db.refresh_alignment(conn)`.
Optionally switch to `REFRESH ... CONCURRENTLY` (unique index supports it), noting it needs an
autocommit connection and can't run in the in-transaction rebuild path.

**Throttle test asserts on wall-clock elapsed time (nondeterminism coupling)**
`apps/scraper/tests/test_api_client.py:57-65` (E2)
`test_throttle_spaces_requests` captures `t0` *after* the first request already set
`_last_request_at`, then asserts `elapsed >= 0.075`; a >5ms scheduler/GC pause between those
points shrinks the remaining sleep below the threshold and flakes on loaded CI. Fix: fake the
clock — monkeypatch `time.monotonic` and `asyncio.sleep`, and assert the second request
requested a ~80ms sleep rather than measuring real elapsed time.

---

## Cut list (over-engineering)

**Name-normalization helper is triplicated (severity: medium)**
`apps/scraper/src/parteidistsipliin_scraper/db.py:542-546` and `db.py:633-637` (E3)
`member_name_dob_to_id` and `member_norm_name_to_id` each redefine an inner `norm()` that is
byte-identical to each other and to `election_parse.normalize_name` (`election_parse.py:40-42`)
— three copies of a matching key that must stay in sync or member-matching silently diverges.
Cut: `from parteidistsipliin_scraper.election_parse import normalize_name` (no circular import),
delete both inner functions and their local `import re`/`import unicodedata`, call
`normalize_name(...)` directly (~12 lines gone).

**Empty `parsers/` package kept "for later," with stale README docs (low)**
`apps/scraper/src/parteidistsipliin_scraper/parsers/__init__.py:1-2` (E3)
The package holds only a comment, exports nothing, and is imported nowhere; `apps/scraper/README.md:31-45`
still documents non-existent parser "stubs" and a pytest workflow, actively misleading. Cut:
delete the `parsers/` directory and the stale README bullets; recreate only if a real API gap
appears.

**Throttle/backoff logic duplicated verbatim across the two HTTP clients (low)**
`apps/scraper/src/parteidistsipliin_scraper/api_client.py:92-96` and `ariregister_client.py:66-70` (E3)
`_respect_delay` is byte-identical in both clients and the `_get` retry loops are near-identical
(ApiClient additionally retries `RequestError`). Copy-pasted politeness that must stay in
lockstep — and note this is the same root cause as the F2 AriregisterClient-retry gap above.
Cut: extract a module-level `respect_delay(last_at, delay_s)` (and optionally a shared retry
loop) both clients call; a base class would be over-abstraction for two implementations.

**`compactNumber` hand-rolls `Intl.NumberFormat` compact notation (low, optional)**
`apps/web/lib/speeches.ts:22-27` (E3)
Manual `1e6`/`1e3` branching reproduces `Intl.NumberFormat(locale, { notation: 'compact',
maximumFractionDigits: 1 })`. Caveat: output is not byte-identical (Intl emits uppercase `K` and
decimals on thousands), so this is a small visible formatting change, not a pure deletion. Cut
only if the exact `k`/rounding style isn't load-bearing; otherwise leave it.

---

## Findings count

| Auditor | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| F1 scoring | 0 | 0 | 0 | 0 | 0 |
| F2 ingestion | 0 | 0 | 1 | 2 | 3 |
| F3 web-data | 0 | 0 | 0 | 2 | 2 |
| F4 ui/i18n/a11y | 0 | 0 | 0 | 3 | 3 |
| E1 migrations | 0 | 0 | 1 | 2 | 3 |
| E2 tests | 0 | 0 | 3 | 1 | 4 |
| E3 over-engineering | 0 | 0 | 1 | 3 | 4 |
| **Total** | **0** | **0** | **6** | **13** | **19** |

---

# Verification pass (adversarial, 2026-07-01)

Every one of the 19 findings was handed to an independent skeptic that read the real code and
defaulted to refuting. Result: **18 confirmed, 1 partial, 0 refuted** — the review invented
nothing. But the skeptics **corrected severity down**: all 6 "medium" findings drop to low, and
3 confirmed findings are **not worth a diff**. After correction, **nothing is above low
severity** and the net actionable list is **16 items (14 low + 2 trivial)**.

## Corrected verdicts

| id | corrected severity | verdict | worth fixing |
| --- | --- | --- | --- |
| E1-refresh-needless | low | confirmed | yes |
| F2-draft-outcomes | low | confirmed | yes |
| F2-arireg-retry | low | confirmed | yes |
| E1-two-txn | low | confirmed | yes |
| E2-apiclient-branches | low | confirmed | yes |
| E2-faction-term-untested | low | confirmed | yes |
| E2-election-fixture | low | **partial** | yes |
| E2-throttle-wallclock | low | confirmed | yes |
| E3-norm-triplicated | low | confirmed | yes |
| E3-empty-parsers | low | confirmed | yes (docs only) |
| F3-waterfall | low | confirmed | yes |
| F4-aria-current | low | confirmed | yes |
| F4-aria-pressed | low | confirmed | yes |
| F4-th-scope | low | confirmed | yes |
| E1-0021-if-not-exists | trivial | confirmed | yes |
| F3-word-count-retokenize | trivial | confirmed | yes |
| F2-speech-rebuild-drift | trivial | confirmed | **no** |
| E3-client-dup | trivial | confirmed | **no** |
| E3-compactnumber | trivial | confirmed | **no** |

## Overstated / dropped by the skeptics

- **E2-election-fixture (partial)** — coverage gap is real, but the cited line list is wrong:
  `election_parse.py:97`'s None branch *is* exercised (REINSALU has no `<mandateType>`, asserted
  at test line 76). The other four None branches are genuinely unreached.
- **F2-speech-rebuild-drift (drop)** — real divergence, but confined to `period_end` / `fetched_at`,
  two metadata columns no view/query/scoring path reads; `fetched_at=now()` is an intentional
  audit stamp. Displayed counts are byte-identical.
- **E3-client-dup (drop)** — `_respect_delay` is byte-identical but the only cleanly extractable
  piece; the two `_get` loops have legitimately diverged (json/bytes vs text, transport-retry in
  one only), so a base class for two callers is marginal.
- **E3-compactnumber (drop)** — hand-rolled, but output deliberately differs from Intl compact
  (lowercase "k", integer thousands). Swapping to Intl is a visible UI regression, not a
  simplification. Leave it.

## Net "worth fixing", by cost

**One-liners / trivial:** E1-0021-if-not-exists (`IF NOT EXISTS`), F3-word-count-retokenize
(reference stored column), F4-aria-current, F4-aria-pressed, E2-throttle-wallclock (move `t0`).

**Small, self-contained:** F2-draft-outcomes (one call in the rebuild loop), F2-arireg-retry
(copy ApiClient's `try/except`), E1-refresh-needless (`if n:` guard + drop the members-path
refresh), E3-norm-triplicated (import `normalize_name`, delete two copies), E3-empty-parsers
(fix stale README, keep the package), F3-waterfall (`Promise.allSettled`), F4-th-scope (promote
name cell to `<th scope="row">` across 3 tables), E1-two-txn (wrap body+version INSERT in one txn).

**Needs a test harness (separate pass):** E2-faction-term-untested, E2-apiclient-branches,
E2-election-fixture — the scraper suite has no DB harness today; cheapest win is extracting the
"open a new term?" decision into a pure function.
