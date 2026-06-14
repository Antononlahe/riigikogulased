# Progress log

Append-only history of code and data changes. Newest entry at the top.

Entry format:

```
## YYYY-MM-DD — Short title
**What:** one or two sentences describing the change.
**Why:** the reason / driving question / linked decision.
**Touched:** key files or areas.
```

---

## 2026-06-14 — Add progress.md and progress-log.md

**What:** Created a two-file progress system: `progress.md` for the current snapshot
(status + next slice) and `progress-log.md` for append-only history. Updated
`CLAUDE.md` with the rule to keep them current.

**Why:** Multi-session work needs a durable "where are we" surface that's faster to
read than the full CLAUDE.md, plus an audit trail of what changed and why so future
sessions don't undo decisions or repeat work.

**Touched:** `progress.md`, `progress-log.md`, `CLAUDE.md`.

---

## 2026-06-14 — Bootstrap monorepo (v0.1 scaffold)

**What:** Initial scaffold for the parteidistsipliin project: pnpm workspace with
`apps/web` (Next.js 15 + TypeScript + next-intl ET/EN + Tailwind v4) and
`apps/scraper` (Python 3.11 + httpx + selectolax + psycopg + Typer, uv-managed),
plus `packages/db/migrations/0001_initial.sql` defining the schema and the discipline
views. Added GitHub Actions workflows for CI and a daily scrape, gitignore, env
examples, and project-level README + CLAUDE.md.

**Why:** Stand up the smallest end-to-end shape for v0.1 (sortable members list with
overall discipline score) so the first real data and deploy can land without
re-arguing layout or stack choices.

Key decisions captured during the quiz (locked in CLAUDE.md):
- "Voting against party" = majority of own faction voted differently, computed with
  self excluded from the majority denominator.
- Procedural votes (`kohaloleku kontroll`, `päevakorra kinnitamine`) are excluded
  from the score via a `procedural_vote_types` lookup table — adding a new
  procedural type is a single `INSERT` with no code change.
- Scope cap for v0.1 is members list + score. Timeline + party-switch line move to
  v0.2.
- Seed scrape = full 15th Riigikogu term (2023-).
- Stack: Next.js full-stack on Vercel + Python scraper running from GitHub Actions
  cron, writing to Neon Postgres.

**Verified:** Migration applies cleanly to local Postgres 16. `member_discipline`
view returns correct counts against synthetic 3-MP / 2-vote dataset including the
procedural-vote exclusion. `pnpm typecheck`, `pnpm --filter web build`, ESLint, ruff,
and pytest all pass.

**Touched:** new repo, see commit `b65ea84`.
