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

| Version | Features |
| --- | --- |
| v0.1 (current) | Members list with overall discipline %, sortable by score / party / vote count. Seed = 15th Riigikogu (2023-). |
| v0.2 | Per-member detail page: timeline chart of with/against-party votes, vertical line at party-switch dates. |
| v0.3 | Vote-topic categorization (bill committee / agenda type) so users can filter discipline by topic. |
| v0.4 | Party-level rollup view (cohesion per party). |
| v1.0 | Polished UI, robust historical backfill, search, social share cards, English content review. |

Stay inside the current version's scope. New ideas go to GitHub issues, not into the diff.

## Architecture

```
Riigikogu site  ->  apps/scraper (Python, cron'd from GitHub Actions)
                              |
                              v
                       Postgres (Neon)
                              ^
                              |
                       apps/web (Next.js on Vercel) -> users
```

The scraper writes; the web app only reads. There is no write path from the web app.

## Core metric: "voting against party"

For a vote V and member M who belongs to party P at time of V:

1. If V is a procedural vote (`vote_type_slug` in `procedural_vote_types`) — exclude.
   Default exclusions: `kohalolekukontroll` (presence check) and
   `paevakorra-kinnitamine` (agenda adoption). These are routine and noisy.
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
  natural key. Do not delete rows; party switches are modeled as `member_party_terms`
  with `ended_on`.
- **Scraper politeness**: respect robots.txt, identify with the configured user-agent,
  default 500 ms delay between requests. Save raw HTML to `apps/scraper/raw_html/`
  (gitignored) when scraping; tests run against fixtures committed under
  `apps/scraper/fixtures/`.
- **No emoji in code, commits, or docs.**

## Data model (cheatsheet)

- `parties` — fraktsioons
- `members` — MPs (one row forever, even across terms)
- `member_party_terms` — `(member_id, party_id, started_on, ended_on)` history
- `sittings` — Riigikogu sittings (one per voting day)
- `votes` — individual vote events (the things on the listing page)
- `ballots` — `(vote_id, member_id, choice)`, choice in `yes|no|abstain|absent|neutral`
- Views: `member_vote_alignment`, `member_discipline`, `member_current_party`

## Things to be careful about

- Riigikogu uses Estonian date format `DD.MM.YYYY` in URLs and HTML. Normalize at the
  parser boundary.
- The vote-detail URL contains a UUID. Use it as `votes.riigikogu_uuid`.
- A member's faction can change mid-term (defections, party splits, joining the
  unaffiliated bench). The seed `member_party_terms` is the source of truth. Cross-
  check after each scrape run.
- "Absent" vs "did not vote" vs "neutral" — Riigikogu distinguishes these. Be precise
  in `ballots.choice` and don't collapse them at ingest time.

## Network policy in dev sandboxes

This repo is sometimes opened in restricted-egress environments that can't reach
`riigikogu.ee` directly. In that case:
- Run the scraper locally or in GitHub Actions, not in the sandbox.
- Tests in `apps/scraper/tests/` parse committed HTML fixtures — they should always pass
  offline.

## Deferred / open

- Vote topic classification model — manual rules first, possibly LLM-assisted later.
- Caching strategy for the dashboard once timeline charts land (likely ISR with 1h
  revalidate).
- Robots.txt compliance check is currently informal — formalize before going public.
