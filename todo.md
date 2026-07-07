# TODO

## New hub cards from data already in the DB

- [ ] Biggest spender / thriftiest — `member_expenses` (powers /statistika/kulud); most/least card with EUR values.
- [x] Cheapest vs dearest mandate — `member_election_results`: fewest personal votes behind a seat vs the biggest vote-magnet. (shipped 2026-07-07)
- [x] Veteran vs newcomer — `members.parliament_seniority_days`. (shipped 2026-07-07)
- [x] Signature word — `signature_terms`: one member + their most distinctive word, links into speech search. (shipped 2026-07-07)
- [x] Joiner-in-chief — `member_caucuses`: most parlamendiryhmad memberships. (shipped 2026-07-07)
- [ ] Most common hobby / alma mater — `member_hobbies` / `member_universities` ("12 saadikut mangivad tennist").
- [ ] Faction switcher — most faction terms in `member_faction_terms` this koosseis.
- [ ] Hottest topic — Eurovoc field with the most votes this session, linking to topic-filtered stats.
- [ ] Bills passed vs dropped this year — `draft_outcomes`; non-person card like the closest-vote one.

## New data to ingest (effort-to-payoff order)

1. [ ] Written questions + interpellations — same Riigikogu API (client/cache/rebuild already exist). Card: most inquisitive MP; which minister gets grilled.
2. [ ] Bills + sponsors — also in the API. Most productive lawmaker, sponsorship success rate, cross-party co-sponsorship.
3. [ ] Heckles (vahelehyyded) — stenograms mark interjections; likely just a speech-type filter on existing ingestion. Card: biggest heckler (most shareable card).
4. [ ] Huvide deklaratsioonid (public register) — side income, board seats, loans, securities. New scraper; serious-journalism tier.
5. [ ] ERJK party-financing open data (erjk.ee) — MPs as donors to their own party, biggest donor-MPs.
6. [ ] Ariregister open data CSV dumps — company board/ownership roles matched by name+DOB (same technique as erakond). Overlaps with #4.

Pick: do 1-3 first — all reuse the existing API pipeline, no new source risk.
