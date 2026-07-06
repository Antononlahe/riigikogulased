# Front page reframe: general stats hub

**Date:** 2026-07-06
**Status:** design, awaiting review

## Problem

The front page (`/`) is a sortable party-discipline table. It's the site's unique angle
but it isn't a *hook* — a bare 100-row table has no entry point for a casual visitor.
Separately, `/statistika/otsustavad` (decisive votes) reads as pointless: the honest answer
to "did a defection flip the vote?" is almost always no, so the page is anticlimactic.

## Goal

Turn `/` into a scannable "general stats hub" — a grid of superlative cards that hook the
visitor, each linking through to the full page behind it. Keep party discipline as the
flagship (its own page), but stop making it the front door. Reframe Otsustavad around the
rare closest calls instead of the common "nothing changed".

## Decisions (from brainstorming)

- Home = **cards only**; the discipline table moves to its own route.
- Card lineup = **core 6 + human interest** (8 cards total).
- Otsustavad = **reframe to "closest calls"**.
- Card style (default, overridable): **person-forward** — eyebrow label, member/faction name
  as the headline, the stat as a bold value, party badge + avatar.
- Tagline (default, overridable): **broaden** from the discipline question to
  "Riigikogu numbrites" / "The Riigikogu in numbers".

## Routes

| Route | Change |
|---|---|
| `/` | **New content:** stat hub (8 cards). No table. |
| `/parteidistsipliin` | **New route:** current home content moved verbatim — discipline table + faction cohesion bars + elected-not-sitting section. |
| `/statistika/otsustavad` | **Reframed:** rank votes by closeness (`flip_gap` asc via `getCloseVotes`), lead with the tightest; relabel heading/intro to "Napimad hääletused". |
| everything else | unchanged |

`/` still exists, so no redirects are needed. The rebel card and the `Parteidistsipliin`
nav heading both point to `/parteidistsipliin`.

## The 8 cards

Each card = the top row of a query that already exists. Whole card is a tap target.

| Card (ET) | Source | Value shown | Links to |
|---|---|---|---|
| Suurim mässaja | `getMemberDiscipline` (lowest %, min-votes floor) | `vastu {pct}%` | `/parteidistsipliin` |
| Suurim kulutaja | `getExpenseLeaderboard` | `{eur} €` | `/statistika/kulud` |
| Sõnaohtraim | `getSpeechLeaderboard` | `{n} sõna` | `/statistika` |
| Enim puudumisi | `getAbsenceLeaderboard` | `puudus {n}×` | `/statistika/varia/kohalolek` |
| Lõhestunuim fraktsioon | `getFactionComparison` (lowest cohesion) | `ühtsus {pct}%` | `/parteidistsipliin` |
| Napim hääletus | `getCloseVotes` | `{gap} häälega` | `/statistika/otsustavad` |
| Noorim saadik | `getMembersWithAge` (min age) | `{age} a` | `/statistika/varia/polvkonnad` |
| Lasterikkaim | `getChildren` (top row) | `{n} last` | `/statistika/varia/inimesed` |

**Min-votes floor** on the rebel card: reuse whatever floor the discipline table applies;
if none exists, require `counted >= 20` so a member with 2 votes and 1 defection can't win
"biggest rebel". Same floor logic for any %-based card.

## Components

- **`StatCard`** — one component, 8 instances. Props: `eyebrow` (label), `name`,
  `party` (short name → `PartyBadge`), `value`, `valueLabel`, `href`, optional
  `photoThumbPath` (→ `MemberAvatar`; faction card has none). Whole card is a
  next-intl `<Link>`.
- **`StatHub`** — the grid: 1 col mobile → 2 sm → 4 lg, `gap`-based layout, no per-card
  margins.
- Reuse existing `PartyBadge`, `MemberAvatar`.

## Data

New `lib/hub-queries.ts`:

```
getStatHighlights(): Promise<{
  rebel, spender, talker, absentee, splitFaction, closestVote, youngest, mostChildren
}>  // each field is a Highlight | null
```

Runs the 8 queries with `Promise.allSettled` in parallel; any that reject → that field is
`null` → the card is hidden (graceful, matches the member-page pattern). Cache via the same
`revalidate = 86400` the other pages use. A `Highlight` is
`{ name, party, value, valueLabel, href, photoThumbPath? }`.

## i18n

New `hub` namespace (et + en): `intro`, plus per-card `*Title` and value templates
(`vastu {pct}%`, `{eur} €`, `{n} sõna`, `puudus {n}×`, `ühtsus {pct}%`, `{gap} häälega`,
`{age} a`, `{n} last`). Broaden `site.tagline`. Relabel the Otsustavad heading/intro.
No `nav` key changes (only the `members` link's `href` moves in `site-header.tsx`).

## Mobile

Card grid is 1-col on phones; each card is a full-width tap target with the name, value and
badge stacked. Header nav already `flex-wrap`s (4 headings unchanged). No horizontal scroll.

## Out of scope

- No new metric computation beyond top-row-of-existing-query.
- No analytics instrumentation.
- No visual redesign of the inner leaderboard pages (only Otsustavad's ordering + copy).

## Testing / verification

- Typecheck clean.
- Local render with a stub DB: `/` shows 8 cards (or fewer if a query is empty, none 500),
  `/parteidistsipliin` shows the moved table, `/statistika/otsustavad` renders closest-first.
- One check on `getStatHighlights`: assert the rebel highlight respects the min-votes floor
  (a low-count member with a low % is not selected).
