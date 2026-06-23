# POC: Ingesting Riigikogu MP expense reimbursements (kuluhüvitised)

Date: 2026-06-23. Scratch feasibility check. No DB writes, no migrations, no commits.

## TL;DR verdict

Partially feasible, but the official API (our source for everything else) does NOT carry this data.
Per-MP expense reimbursement (kuluhüvitised) is published by the Riigikogu ONCE A YEAR (mid-March,
covering the previous year) as a flat table of names + euro amounts. There is NO stable URL, NO JSON
API, NO open-data dataset, and NO date-of-birth or stable id attached. Media (Postimees, Delfi,
ERR/BNS) republish the table each March; the underlying release is effectively a public-records
artifact, not a maintained dataset. Ingesting it means scraping a once-a-year HTML/PDF/Excel table
and joining to our members BY NAME ONLY, with the source URL changing every year.

## (a) Source URL(s) + format
- api.riigikogu.ee/v3/api-docs (api-docs.json, 181KB): grep kulu|hüvitis|expense|cost|reimburs|allowance = ZERO hits. 70 paths in api-paths.txt, none expense-related.
- /api/plenary-members/{uuid} (helme_api.json): no expense field. (Does carry dateOfBirth.)
- Member HTML profile page (178KB): grep -ic kulu = 0. Not a JS shell.
- palgaandmed.html (riigikogu.ee/riigikogu/koosseis/palgaandmed/): only links the two POLICY PDFs (how reimbursement is calculated), no per-member numbers.
- riigikogu.ee/avaandmed/: points only to the JSON API + github.com/riigikogu-kantselei/api.
- avaandmed.eesti.ee (national portal, API works): kulu/hüvitis/riigikogu searches return household/social/election stats only. No MP-expense dataset.
- Where the table surfaces: annual media republications. jarvateataja 17 Mar 2024 "sel nädalal avalikuks tehtud ... kuluhüvitiste nimekiri"; Delfi/Vahur Koorits "TABEL: ... limiidi viimse sendini ära"; ERR/BNS "Allikas: BNS", "kuluhüvituste aruandest".
- Format: annual flat table member-name -> euro amount(s), released by Kantselei, picked up by BNS/media mid-March. No canonical machine-readable download discoverable; raw table in practice via public-information request to the Kantselei or scraping a media table.

## (b) Granularity + key fields (real values, 2023 Apr-Dec release)
- Per member, per year, with a per-member annual LIMIT (2023: EUR 14,598.45; earlier year EUR 12,168).
- Coarse category breakdown exists: sõidukulud (transport) EUR 434,376.36 total; esinduskulud (representation) EUR 248,327.45 total; vehicle-lease cap EUR 450/mo. Whether the published table itemises EVERY member by category vs only per-member total + aggregate sums is NOT confirmed (ERR/BNS gave per-member totals only).
- Real per-member examples: Martin Helme 14,598.45 (100%, EKRE); Rain Epler 14,598.45 (EKRE); Maria Jufereva-Skuratovski 14,598.45 (non-attached); Eduard Odinets 13,677 (SDE); Kersti Sarapuu 12,198.
- Aggregates: total 944,606.82; ~528,000 unused; 10 members used 0 (ministers + Lehtme + Pohlak).

## (c) Joinability
- Source identifier: FULL NAME ONLY. No DOB, no personal code, no uuid (ERR confirms full name only). Weaker than äriregister (name+DOB).
- Our side: members has full_name + date_of_birth; API has DOB. But the expense list gives only the name string.
- Match quality: ~101 members, name collisions ~nil, but gotchas: hyphenated names (Maria Jufereva-Skuratovski), declension/order/diacritic drift. Name-normalised exact match covers the majority; expect a handful of manual aliases.
- Verdict: joinable via name-only fuzzy match + manual alias table; OK for ~101 rows/year, not robust enough to run fully unattended without a yearly coverage check.

## (d) Feasibility + effort + hardest part
- Feasible IF we accept: annual cadence, name-only join, source = media/records artifact not the API. Does NOT fit the "official API, stable uuid, offline-reproducible" model.
- Effort: M (medium), dominated by sourcing not code. Scrape a media table: S-M. Authoritative Kantselei file via records request: M + a manual non-automatable step each March (breaks unattended cron).
- Hardest part: getting a stable machine-readable raw source (no canonical URL; cleanest copy is paywalled media or a records request). Secondary: name-only join (no DOB) and confirming whether per-member category itemisation is actually in the table.

## (e) Minimal ingestion sketch (NOT wired in)
- Source strategy: treat like äriregister — a second non-API source with own client/parser/cache. Best: a discoverable yearly Kantselei file; fallback: a designated media table; worst: manually-obtained CSV/XLSX dropped into cache.
- Politeness/cache: 1 req/s httpx client; archive raw gzip-committed under cache/expenses/ for offline rebuild.
- Parser: expenses_parse.py — normalise name (casefold, strip diacritics, handle hyphenation); parse Estonian euro format (space thousands, comma decimal: 14 598,45). Emit (year, name_raw, name_norm, total_eur, {category: eur}?).
- Matching: name_norm exact -> members.full_name (normalised); small hand-curated alias map; FAIL LOUDLY if yearly coverage < ~95% of sitting members.
- Proposed table (additive, do NOT migrate yet):
  member_expense_periods(id, member_id FK members, term_id FK riigikogu_terms, period_start, period_end, limit_eur, total_eur, transport_eur, represent_eur, other_eur, source, UNIQUE(member_id, period_start, period_end)). Plus a member_expense_summary view (used/limit). No scoring change — standalone facet.

## Saved samples (this dir)
- api-docs.json — full OpenAPI spec (no expense endpoint).
- api-paths.txt — all 70 API paths.
- helme_api.json — real per-member API record (no expense field; has dateOfBirth).
- palgaandmed.html — official salary/expense page (only policy PDFs).
- rup_article.html — media republication with real 2023 per-member numbers.
