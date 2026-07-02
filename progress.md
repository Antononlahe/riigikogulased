# Progress

**Last updated:** 2026-07-02
**Version target:** v0.4 (party/faction rollups). **v0.4-A is DONE and LIVE in prod** —
https://parteidistsipliin.vercel.app/fraktsioonid. v0.3 (D1+D2) and v0.2 also live.
**Branch:** `claude/clever-noether-ch7018`

## Current status

**/teemad topic explorer REMOVED (2026-07-02).** User verdict: pointless. Deleted the UI only
(`app/[locale]/teemad`, `components/topics`, `lib/topics*`, nav link, `/topics` redirects,
`topics` message namespace); the Eurovoc data layer (0005, `vote_topics`, `eurovoc` CLI) stays.
Its nav slot went to Otsustavad hääled.

**Otsustavad hääled (decisive votes) — DONE + LIVE IN PROD (2026-07-02).**
New page `/statistika/otsustavad`: did voting against the fraktsioon line ever flip an outcome?
Vote thresholds are respected — the API doesn't expose the passage rule, so
`api_parse.required_majority` derives it (umbusaldusavaldus PS §97, ettepanek Vabariigi
Valitsusele RKKTS §154 lg 2, saadikupuutumatus PS §76, and PS §104 laws by title pattern all
need 51 yes; everything else yes > no; 45/1719 votings classified 'members'). Migration
**`0022_decisive.sql`** adds `votes.required_majority` + `votes.document_title` (umbusaldus
votings carry only relatedDocument) and the `vote_decisiveness` view (per-vote counterfactual:
all defectors vote the line; cf counts, passed/cf_passed, flip_gap). Answer today: **0 flips**
out of 280 defection votes — the page leads with that as the headline empty state, with a
client-side "näita napilt" toggle revealing near misses (defectors ≥ flip gap; currently 2:
2023-09-21 ettepanek-VV otsus 37:19 w/ 17 defections, 2024-06-12 tuumaenergia otsus 41:25 w/
16). New `thresholds` CLI backfills the two columns offline from the votings cache; ingest
sets them for new votes. Verified: 82 scraper tests, web tests, build green.
**Shipped (user-authorized):** `migrate` (0022) + `thresholds` run on prod. NB: the committed
votings cache is the stale 1-year slice (598), so the full-term backfill was completed with an
ad-hoc pass: classify all 2224 votes from DB slug+draft_title, plus API fetch of the 12 final
votes lacking both draft and document title (all but 2 were umbusaldus motions, incl. both PM
no-confidence votes). Final: **158 votes classified 'members' (51 needed)**; still 0 flips,
2 near misses, 280 defection votes. Deployed.

**Mobile tables overhauled — DONE + LIVE (2026-06-30).** Tables were collapsing instead of
scrolling on mobile. Added shared `components/ui/scrollable-table.tsx` (min-width so scroll works +
CSS scroll-shadow + sticky first column), applied to all data tables; the three primary tables
(homepage, both leaderboards) now render as stacked **cards under `sm`** (no sideways scroll). No new
deps — it was a CSS/layout problem, not a data-grid one. See progress-log for details.

**Kuluhüvitised (MP expense compensations) — DONE + LIVE (2026-06-29/30).** Dataset shipped:
member_expenses (`0020`), name-matched ingest (321/335), member panel, `/statistika` ?vaade= toggle
with opt-in per-category breakdown rows, and pooled expense-usage % on `/fraktsioonid`.

<details><summary>Original kuluhüvitised landing note</summary>

**Kuluhüvitised (MP expense compensations) — CODE DONE (2026-06-29), pending prod ingest + deploy.**
New civic-transparency dataset (out of the v0.4-0.7 roadmap; a self-contained slice). Source: Riigikogu
published summaries, committed as CSVs under `apps/scraper/cache/kuluhuvitised/` (koond = limit+spent,
liikide = category split), 2023-25. Matched to members by normalized name (no DOB in the source).
- Migration `0020_member_expenses.sql` — `member_expenses (member_id, year, limit_eur, spent_eur,
  breakdown JSONB)`, additive, no view touched.
- Scraper: `expense_parse.py` (+ test) and the `kuluhuvitised` CLI command (no network, no alignment refresh).
- Web: `/statistika` now has a server-driven `?vaade=` toggle between two leaderboards (Kõnelejad /
  Kuluhüvitised) — the ~100-row tables are too long to stack; the expense view has a year selector
  (`?vaade=kulud&aasta=YYYY`). New `ExpensePanel` on the member page (spent/limit bar per year +
  category split). All queries guarded (missing table => empty state).
- **TODO (gated, user-run): apply prod migration + ingest, then deploy.** See progress-log for commands.

</details>

**Homepage table group dividers — DONE + LIVE (2026-06-26).** Added thin vertical `border-r border-border`
dividers on the homepage Liikmed table to delineate the three column groups: Vastu | Kohalolek | Mandaat
(matching the statistika leaderboard style). Pure CSS change on `<th>` and `<td>` for the `defections`
and `attendance` columns. No logic change.

**Per-member attendance % on the homepage — DONE + LIVE (2026-06-26).** New sortable "Kohalolek"
column on the Liikmed table. Attendance = ballots where `choice <> 'absent'` over all the member's
ballots (mirrors `faction_attendance`; `neutral`/did-not-vote = present; denominator is
tenure-bounded since ballots only exist for rostered votings; includes procedural). New
`member_attendance` view (migration `0019`, applied to prod via Neon MCP). The homepage's
`counted_votes > 0` filter already hides the all-absent never-seated substitutes.

**Homepage discipline bar removed — DONE + LIVE (2026-06-26).** Dropped the colored `DisciplineBar`
from the homepage members table (kept the % as text) per user ("not helpful"); the component
remains in faction-roster/topic/discipline-summary.

**Leaderboard inline/split member detail — REVERTED + IDEA DROPPED (2026-06-26).** Briefly added to
`/statistika`, then pulled (wrong page + a summary panel duplicates the row's numbers). User decided
to **drop the member quick-peek entirely** — the full `/members/[slug]` page already serves it and is
one click away. Drawer/overlay with dimming was also rejected. Not revisiting unless asked.

**Tenure context + per-time speech rate — DONE + LIVE IN PROD (2026-06-26).** Raw speech counts
understate recently-joined MPs (substitutes haven't had time to speak). Added to the speaker
leaderboard a **"Kuud RK-s" (months served) context column** + an **Absoluutne / Aja kohta (per-month)
toggle** that normalizes the volume metrics by tenure (`daysInTerm = CURRENT_DATE - mandate_started_on`,
computed in SQL — no migration). Per-month uses a **90-day floor**: sub-floor members' rate is shown
but parked at the bottom + flagged (∗), since a tiny denominator gives a misleadingly high rate.
Mirrored on the member speech panel: a **tenure pill** + a note for recent joiners (< 90 days). Pure
logic in `lib/speeches.ts` (mode-aware `speakerMetric`/`sortSpeakers`, `isRateEligible`), 3 new tests.
Deployed; live-verified ET+EN (toggle + column render; Stig Rästa "15 kuud"). NB: shortest current
tenure is 199 days, so **no member is under the floor today** — the ∗/uus flag has no live example yet
(correct). See progress-log 2026-06-26.

**Juhatus speech-context badge — DONE + LIVE IN PROD (2026-06-26).** The speech ingest filters
short procedural remarks (`MIN_TEXT_LEN=60`), which disproportionately suppresses the Riigikogu
esimees/aseesimehed tallies; users had no context. Capture `plenaryMembership.role` as
`members.board_role` (migration **`0018`**, ESIMEES/ASEESIMEES/NULL) and surface a **badge +
explanatory note** on the member speech panel and the speaker leaderboard (et+en). Role is read
live from the API, so it **self-corrects when the board changes** (single current-role column —
no history of past board members, acceptable). Added a daily **`members` cron step** so board
changes refresh without a manual run. Prod: `0018` applied via Neon MCP; `members` run populated
board_role (Hussar=ESIMEES; Aller, Kivimägi=ASEESIMEES); deployed; live-verified ET+EN on
`/members/lauri-hussar` and `/statistika`. See progress-log 2026-06-26.

**Daily cron now ingests speeches + stenograms (2026-06-25).** The scheduled scrape only ran
`daily` (votings); the `speeches`/`verbatims` commands existed but nothing ran them. Added both as
daily steps. Also fixed `speeches`: `/api/statistics/speeches/plenary` now 418s for ranges over
~2 years, so `_refresh_speeches` chunks the term into ~1-year windows and sums (see progress-log).

**Non-sitting winners + homepage filter + polish — DONE + LIVE IN PROD (2026-06-25).**
(1) New `election_candidates` table (migration `0017`) + homepage section "Valituks osutus, kuid
kohta ei võtnud": the **14 candidates who won a 2023 mandate but never sat** (declined — Kaja Kallas
31816, Kõlvart 14592, Michal, Paet…), ranked by votes. Parser/`cli` persist unmatched-elected;
`getElectedNonSitting` web query. (2) Homepage **"Näita endisi liikmeid" checkbox** — off by default
→ only the **101 active** MPs (count updates). (3) **Statistika moved to 2nd** in nav. (4) Leaderboard
abbreviation now **words-only** (293k); speech counts full. (5) **Luisa Värk speech bug** fixed in
code (alias "Luisa Rõivas"→"Luisa Värk" in verbatim attribution, 3→58 speeches) — **prod speech
backfill pending the user's `verbatims`/`rebuild` re-ingest**. Prod `0017`+14 rows applied via Neon MCP
(user-approved). See progress-log 2026-06-25.

**Name-mismatch fixes — DONE + LIVE (2026-06-25).** (a) **Luisa Värk** speeches backfilled in prod
(3 → 58): her old-name "Luisa Rõivas" speeches parsed offline + lemmatised (EstNLTK) + inserted via
Neon MCP (scraper can't reach prod from here). Durable alias already committed. (b) **Stig Rästa**
election result fixed: candidate "Raul-Stig Rästa" (1142 votes, substitute) didn't match member "Stig
Rästa"; extended the unique-DOB fallback to non-elected candidates when the DOB is unique in the pool.
Row inserted in prod (1142 · Asendusliige). Both live-verified.

**Open follow-up:** "Who replaces whom / why" for asendusliikmed remains infeasible without a curated
seat-swap seed (API has no replacement link).

**(earlier) Homepage election + /statistika word columns — DONE + LIVE IN PROD (2026-06-25).** Two additive
UI bits, no migration/re-ingest. (1) Homepage members table: the 2023 **personal-vote count now sits
next to the Mandaat badge** in one column ("7672 Isikumandaat"), sortable by votes; `getMemberDiscipline`
lateral-joins latest `member_election_results`, pure `mandateKey()` in `lib/members.ts`. (2) `/statistika`
speaker leaderboard: two **per-MP sortable columns** — `Sõnu kokku` + `Sõnu/kõne` from `member_speeches`,
**compact-abbreviated** (`compactNumber`, 293043 → "293k"). (Reworked from a first attempt that used a
site-wide tile + separate Hääli column — see progress-log 2026-06-25 ×2.) tsc + lint + 57 web tests
green; live-verified (Epler 293k/185; Ratas "7672 Isikumandaat").

**(earlier) Election results — substitutes added (2026-06-24, LIVE).**

**Election results — substitutes added (2026-06-24, LIVE).** The panel now also covers
**non-elected** candidates who sit as **asendusliikmed (substitutes)** — e.g. Enn Eesmaa (774
votes, district 12, not elected, active → "Asendusliige"). The `0000` results block lists every
candidate, not just winners, so the parser now keeps all of them; the writer matches one row per
member, **elected taking priority**, with the unique-DOB fallback restricted to elected only
(the ~958-candidate pool would otherwise let a shared birthday hijack a member). Migration
`0016_election_substitutes.sql` adds `elected BOOLEAN` + makes `mandate_type` nullable. Prod:
**87 elected + 36 substitutes** (123 rows). Panel labels by elected/active: mandate badge (elected)
/ Asendusliige (active, not elected) / Ei osutunud valituks (former, not elected). Live-verified
ET+EN. See progress-log 2026-06-24.

**Election results — personal votes & mandate type (2026-06-23). DONE + LIVE IN PROD.** A new
data axis: how each MP won their 2023 seat. Source is
the RIA election open data (`opendata.valimised.ee/api/RK_2023/{RESULTS,ELECTION_CANDIDATES}.xml`
— two static XMLs, no auth), chosen over kuluhüvitised + asset-declarations after a 3-way
parallel POC (kuluhüvitised = no API / annual / name-only join → parked; declarations =
eID-gated, no bulk access → dropped; both documented under `apps/scraper/poc/`). Migration
**`0015_election.sql`** (`member_election_results`: member_id, election_code, party_code,
district_number, personal_votes, quota, mandate_type CHECK PERSONAL/DISTRICT/COMPENSATION;
additive, no view/discipline change). Scraper: `election_cache.py` (committed raw-XML archive
under `cache/election/RK_2023/`), `election_parse.py` (pure, parses national block ehakCode 0000),
`db.member_name_dob_to_id` + `member_unique_dob_to_id` (guarded DOB fallback for
nickname/surname-change cases — unique-DOB only, zero false-match risk), `upsert_election_result`,
the **`election` CLI command** (fetch+cache+match+upsert) + rebuild replay. Web: `election-queries.ts`,
`components/member/election-panel.tsx` (sidebar card: personal votes + mandate badge + note),
page wiring, et+en i18n. **Match validated read-only against prod: 87/101 elected MPs matched**
(85 by name+DOB, +2 by DOB fallback: Kalev/Grigore-Kalev Stoicescu, Luisa Värk/Rõivas); the 14
unmatched are all ministers/MEPs who won a seat but never sat (Kaja Kallas, Michal, Tsahkna,
Terras, Toom, …) — correctly excluded, no false matches. Verified: scraper ruff + 75 tests; web
tsc + lint + 52 tests green. **Shipped:** `0015` applied to prod via `migrate`, `election`
ingested (101 elected, **87 matched / 14 unmatched** — the 14 are ministers/MEPs who never sat),
deployed; live-verified (Jüri Ratas 7672 Isikumandaat ET; Urmas Kruuse District mandate EN). A
narrow project permission rule (`.claude/settings.json`) now allows the additive `migrate` command
without a gate prompt. `election` is not wired into the daily cron (frozen per-term data). See
progress-log 2026-06-23.


**Member-page speech panel — word counts + cadence + browse list (2026-06-22).** Three
additive bits on the member page's "Sõnavõtud" panel, all from already-ingested data (no
migration, no re-ingest): (1) two **word-count tiles** (total + avg/speech) from
`member_speeches` text; (2) a **monthly cadence** CSS bar strip (zero-filled axis, recess gaps
show); (3) a **collapsed, scrollable browse list** of all the MP's speeches with three filters
— sort (recent/oldest/longest), year, and **sitting-type** (Istung/Infotund/…). The "type"
filter is `sitting_type`, not a per-speech kõne/küsimus label: the verbatim feed has no
per-speech type, only aggregate counts exist for that (infotund ≈ question time covers the
useful split). Browse mode rides the existing `/api/member-speeches` route (non-empty `q`
searches; else browse). Word totals come from a smaller population than the count tiles
(`member_speeches` is ≥60-char + member-attributed) so they don't reconcile, by design. Files:
`lib/speeches.ts` (+types, sort whitelist), `lib/speeches-queries.ts` (+`getMemberSpeechMeta`/
`browseMemberSpeeches`), `route.ts`, `components/member/speech-{panel,browse}.tsx`, et+en
messages, `speeches.test.ts`. Verified: tsc + lint + 52 web tests green (incl. a sort-whitelist
SQL-injection guard). See progress-log 2026-06-22.


**Committee "cohesion" UI removed (2026-06-22, LIVE).** All committee-discipline UI deleted as
misleading — there is **no per-committee roll-call data** in the API, so the metric was just
aggregate plenary discipline regrouped by committee. Removed the two `/statistika` committee
sections, the `/statistika/komisjonid/[slug]` roster route, and the member-page "Distsipliin
komisjonides" panel; **committee membership is kept** (member sidebar "Komisjonid" list). The
`0010_committee_rollup.sql` views are now applied-but-dead (drop in a future migration if
wanted). `/statistika` is now just the speaker leaderboard. See progress-log 2026-06-22.


**Per-MP stenogram speech search — DONE + LIVE IN PROD (2026-06-19).** A search box on each
member page over that MP's actual stenogram speeches (`/api/steno/verbatims`), with
**Estonian lemma-aware** matching: text is lemmatised at ingest with Vabamorf/EstNLTK into a
`simple` tsvector (base-form queries match all inflections), `pg_trgm` ILIKE fallback for
inflected/typo queries. Migration `0012_speeches.sql` (`member_speeches`); `verbatims` CLI
(async fetch / synchronous batched ingest); `/api/member-speeches` route + client search box.
**100,200 speeches across 117 members backfilled to prod** (full XV term); live-verified
(base "riigikaitse" → 20 highlighted hits; inflected "riigikaitset" → ILIKE fallback). EstNLTK
is an optional `nlp` extra; the daily cron does not yet run `verbatims`. See progress-log
2026-06-19 for the full entry (incl. three bugs fixed) and [[batch-remote-writes]] memory.


**/statistika page + member-page panels — DONE + LIVE IN PROD (2026-06-19).** Shipped six
removable MVPs from `component-storybook.html`, validated live with real data.
- **v0.4 committee cohesion (A/B/C) — REMOVED 2026-06-22 as misleading** (see top of Current
  status). The API has no per-member committee roll-call ballots, so "cohesion" was only
  aggregate plenary discipline regrouped by committee — pulled. Migration
  `0010_committee_rollup.sql` views remain applied-but-dead.
- **v0.4-D member page "Distsipliin komisjonides" panel — REMOVED 2026-06-22** (same reason).
- **v0.5-A** speaker leaderboard on `/statistika`; **v0.5-B** member-page "Sõnavõtud" panel. Data:
  new `speeches` CLI command → `/api/statistics/speeches/plenary` (all members in one call) →
  `member_speech_stats` (migration `0011`), cached to `speech-stats.json`, replayed by `rebuild`.
  Word counts / cadence / topic treemap deferred (need `/api/steno`).

**Removable by design** (see the header comment in `app/[locale]/statistika/page.tsx`). User wants
to evaluate with real data before deciding to keep. Verified: 55 web tests + typecheck + lint green;
build 569/569; live pages 200 with real numbers. See progress-log 2026-06-19 for the full entry.

**Member/faction UI polish (2026-06-19).** (1) Homepage list excludes **substitute members
(asendusliikmed)** — 5 never-seated people whose ballots are all `absent` (0 counted votes);
`getMemberDiscipline` now filters `counted_votes > 0` (124 → 119 shown; detail pages still exist).
(2) Homepage shows a live **member count** next to the party filter. (3) `/fraktsioonid` gained a
**comparative bar chart** (`FactionBars`) for the active sort metric, sharing the dropdown's state
with the cards; both bars and cards **animate on reorder** (Framer `layout`, like the homepage
table). Verified green (typecheck + 48 tests + lint + build); see progress-log for the deploy.

**v0.4-A (faction rollups) — DONE + LIVE IN PROD (2026-06-16).** Also fixed a separate
prod bug found right after: the member-page vote timeline ("Hääletuste ajalugu") was
**invisible for every member** — `@visx` `ParentSize` clipped the chart because its wrapper
had no height (the absolutely-positioned `overflow:hidden` measurement div collapsed to
height 0). Fixed by giving the wrapper an explicit `TIMELINE_HEIGHT` + an SSR fallback width
(`apps/web/components/member/vote-timeline.tsx`); verified live (svg now 640×200, 495 marks
spread, was width=0). This had shipped broken in v0.2/C, whose interactive browser
verification was the one step recorded as "still to do".

**Member-page enhancements (2026-06-17, live):** (1) **Districts** now filter to the current
koosseis (term 15) — a returning MP's earlier-term valimisringkond no longer shows as if
current (Raid was listing both his XII and XV districts). (2) **Member votes redesigned
(defection-first)** after user feedback that the discipline-% trend was meaningless and the
dense strip's marks were unclickable. The trend line is gone; the new `MemberVotes` client
component shows a compact timeline (all votes = faint context ticks, votes-against-the-line =
**large red clickable lollipops** that open the bill) over the **primary "Vastuhääled
fraktsioonile" list**; hovering a marker highlights its row and vice-versa; both link to the
eelnõu page. Two **filters**: a radio (Kõik / Jäi erapooletuks / Hääletas teisiti) and a
vote-type dropdown (Lõpphääletus, Muudatusettepanek, …); the timeline reflects the filter.
Replaced the earlier `vote-timeline.tsx` (legibility/zoom attempt) + `votes-against.tsx`.
Static aspects verified live (one district; 13 red markers + 13 list rows, all eelnõu-linked;
filters render); interactive hover/filter behaviour still needs a human eye (can't browse here).

**Member page — further additions (2026-06-18, live):** (3) **Mouse-wheel zoom** on the
timeline (native non-passive listener, zooms the time window around the cursor; reset button;
ticks/markers filter to the visible window). (4) **Per-vote result panel** — no public
per-voting page exists on riigikogu.ee, so each defection row has an expandable "Kuidas
hääletati" panel built from our `ballots`: per-faction tally (poolt/vastu/erapooletu/puudus)
with the MP's faction + own choice highlighted + overall totals (`getMemberDetail.voteResults`,
faction-at-time). (5) The **"Parteidistsipliin" site title now links home**. 43 web tests +
typecheck + lint + build green; live-verified static aspects. **User still needs to eyeball
the interactive bits**: wheel-zoom, hover cross-highlight, the two list filters, and the
expand panel.

**Bill outcome badge — DONE + LIVE IN PROD (2026-06-18).** The member-page defection list shows
each bill's **final fate** (Vastu võetud / Tagasi lükatud / Tagasi võetud / Menetluses) as a chip
next to the title. Source: the draft endpoint's `activeDraftStage` (already fetched/cached for
Eurovoc) — this is the *bill's* outcome as recorded by Riigikogu, so it **sidesteps the per-voting
majority-threshold problem** (we never compute pass/fail; per-voting pass/fail stays out of scope —
the API gives no per-voting result or threshold). Migration **`0009_draft_outcome.sql`** (table
`draft_outcomes(draft_uuid PK, stage, status, accepted_on, fetched_at)`, a minimal precursor to v0.6
`volumes`). Scraper: `parse_draft_outcome` + `db.upsert_draft_outcome`; outcome upsert folded into
`_ingest_draft_topics`; **`drafts` CLI command** (full fetch; `--refresh` re-fetches cached). Web:
`draft_outcomes` LEFT JOIN in `getMemberDetail` → `VotePoint.outcomeStage`; pure `billOutcome()`
mapper + `OutcomeBadge`; et+en strings. **Shipped:** 0009 applied to prod; `drafts` backfilled
**788 bills (394 adopted, 362 rejected)**; raw draft JSON committed (offline rebuild reproduces
`draft_outcomes`); deployed; live-verified on `/members/juku-kalle-raid` (29 Vastu võetud / 9 Tagasi
lükatud / 1 Tagasi võetud / 6 Menetluses).

**Open follow-up:** outcome refresh is **not** wired into the daily cron yet (a `drafts --pending`
auto-refresh was prototyped 2026-06-19 then pulled back). So in-process bills won't flip to
adopted/rejected on their own — re-run `drafts` manually to update. Revisit when ready.

**`scrape.yml` cleanup (2026-06-19):** the daily run step no longer interpolates
`${{ inputs.command }}` straight into the shell (`if [ -n "…" ]` script-injection antipattern); it
now passes `${{ inputs.command || 'daily' }}` via the `SCRAPER_COMMAND` env var. Behaviour
unchanged: schedule runs `daily`, dispatch runs the chosen command. (The 2026-06-18 cron failure was
a transient `ConnectTimeout` to api.riigikogu.ee from the runner, not a workflow logic bug; note the
`ApiClient` retries 429/5xx but not connection-level timeouts — a candidate hardening if it recurs.)

**Full-XV data backfill — DONE + LIVE IN PROD (2026-06-18).** Prod now spans the **whole XV
term**: **2221 votes (was 598), 193,624 ballots, 124 members (101 active / 23 former),
2023-04-18 → 2026-06-18**; discipline **91,280 counted / 90,772 aligned / 508 defections**
(was 23166/23044/122). A naive additive backfill was unsafe (`set_member_faction` is chronological,
single-open-term), so this was a **clean-slate rebuild from a full cache**: cache-only backfill
→ validated on Neon branch `br-delicate-bird-a67p1t1t` → prod cutover (backup branch
`br-dawn-rain-a609iz8y` → TRUNCATE writer tables [kept parties/procedural_vote_types/
schema_migrations] → `rebuild` → `members` → `photos`) → redeploy. The prod TRUNCATE is
classifier-gated and was **run by the user**; everything else via the app CLI.

**Perf fix during cutover — migration `0008`.** At full-XV scale the homepage + faction-roster +
member-detail builds that read the `member_discipline` / `member_vote_alignment` *views*
(recompute party-at-time over ~190k ballots) exceeded Vercel's 60s/page budget and the first
redeploy FAILED. Fix: `0008_fast_discipline.sql` redefines `member_discipline` to aggregate the
`ballot_alignment` **matview**, and `getMemberDetail`'s breakdown/votes queries were repointed to
the matview too (same columns, same numbers — verified 91,280/90,772/508). Redeploy then
succeeded; live-verified (`/`, `/en`, `/fraktsioonid`, `/teemad`, member pages all 200; Raid
96.2%).

**Follow-ups (not blocking; live is fine):** (1) **`votings.jsonl` is now ~114 MB** — over
GitHub's 100 MB limit, so it is NOT committed; offline `rebuild` reproducibility needs the cache
gzipped + the `ApiVoteCache` reader updated (like the äriregister cache), or Git LFS. The
committed votings cache is currently the stale 1-year version. (2) Delete the Neon branches
(user-gated): `br-delicate-bird-a67p1t1t` (validation), `br-dawn-rain-a609iz8y` (backup, keep
until confident), `br-super-night-a6hqytud` (earlier build-check). (3) The daily cron keeps
appending forward as before; matview refresh is wired.
Built via subagent-driven development (spec/plan `docs/superpowers/{specs,plans}/2026-06-16-v0.4-a-faction-rollups*`).
Adds a faction comparison page (`/fraktsioonid`, card grid of the six fraktsioons) and per-faction
detail pages (`/fraktsioonid/[slug]`, header metrics + member roster ranked by discipline with
most/least-loyal highlighting). **Cohesion = aggregate faction discipline** (the existing per-ballot
alignment rolled up by party — *no scoring change*); **attendance** counts all votes incl. procedural
(`present = choice <> 'absent'`, faction-at-time); member count = current active members of the faction.
No topic panel (deferred). New migration **`0007_faction_rollup.sql`** = two read-only views
(`faction_discipline` over `ballot_alignment`, `faction_attendance` over `ballots`). New web modules
`lib/factions.ts` (pure, 10 vitest tests) + `lib/factions-queries.ts`; components `factions/{faction-card,
faction-grid,faction-roster}`; nav link wired + `/factions → /fraktsioonid` redirect; i18n et+en.

**Verified:** 36 web vitest tests, typecheck, `next lint` all green; **production build 427/427 static
pages** (incl. `/{et,en}/fraktsioonid` + all 12 `/fraktsioonid/[slug]` pages) against a Neon branch
(`br-super-night-a6hqytud`, project rapid-star-29400137) with `0007` applied. Faction cohesion
reconciles end-to-end: the six factions' counted votes sum to **23166** = the global discipline total.
Final whole-slice review (opus): **READY TO SHIP**, no critical/important issues. A real bug was caught
by the build step and fixed: `parties` also holds non-parliamentary erakonds (seeded by the 0003
äriregister reconciliation), so the comparison query now restricts to actual fraktsioons via
`EXISTS member_faction_terms`.

**Deployed to prod (2026-06-16):** applied `0007` to prod via the `migrate` CLI (additive — two views,
no data change), redeployed `apps/web` (`vercel --prod` from `apps/web`). Live-verified:
`/{,en/}fraktsioonid` 200, `/fraktsioonid/ekre` shows Ühtsus 98.6% / 9 liiget / roster, `/factions`
→ 307 → `/fraktsioonid`; prod faction cohesion reconciles (sum counted = 23166).

**Next slice:** v0.4-B — committee votes (ingest `/api/votings/committees` + committee-level
discipline). Cleanup pending (user-gated): delete the Neon build-check branch `br-super-night-a6hqytud`.

## Prior status (v0.3 / D2 — topic explorer)

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

Future work (post-1.0, requested 2026-06-19): **government vs opposition.** Track which
parties form the government (coalition) over time and use it as a second axis on the
discipline story. Entails:
- A new model of **government terms** — `(government, started_on, ended_on)` plus the
  coalition composition `(government, party_id)` per government (e.g. Kallas II/III, Michal).
  Source: not in the votes feed; needs the Riigikogu/Stenbock cabinet history (likely a
  small curated seed table or a separate source, like the äriregister erakond pattern) since
  the API exposes faction membership but not coalition/opposition status.
- Resolve each vote's date → the government in force → label every **faction** as
  coalition or opposition **at the time of that vote** (governments change mid-term, so this
  is time-bounded like `member_faction_terms`).
- New framing this unlocks (UI is additive, discipline definition unchanged): mark
  **government-formation/reshuffle events** on the member timeline (vertical guides, like the
  party-switch lines); distinguish a defection that **sided with the opposition** from one
  that didn't; coalition-vs-opposition cohesion rollups on `/fraktsioonid`; and "how often
  did the opposition actually win a vote" context for the bill-outcome badges.
- Open question: a party can switch sides without an election (coalition collapse/
  reshuffle); the time-bounded coalition table handles it, but the seed data must capture
  those exact transition dates.
