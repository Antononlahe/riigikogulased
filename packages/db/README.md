# db

SQL migrations and read-only views.

## Conventions

- Migrations are forward-only, numbered: `NNNN_short_description.sql`.
- v0.1 has just one migration. Once we add `0002_*`, also add a `schema_migrations`
  tracking table at the top of `0002_*.sql` and start applying migrations in order.
- Views (`member_discipline`, `member_vote_alignment`, `member_current_party`) are
  the public read interface used by the web app — change the column shape only by
  bumping a view name (`member_discipline_v2`) and migrating callers, so the web app
  isn't broken mid-deploy.

## Applying

```bash
psql "$DATABASE_URL" -f packages/db/migrations/0001_initial.sql
```

## Definitions worth knowing

- **Procedural votes** (`kohalolekukontroll`, `paevakorra-kinnitamine`) are excluded
  from discipline scoring. They're routine and would dilute the metric. The list
  lives in the `procedural_vote_types` table — `INSERT INTO procedural_vote_types
  (slug, display_name) VALUES (...)` to add a new type; the views pick it up
  automatically.
- **Discipline score** = aligned / (aligned + defections), where alignment is checked
  only on votes where (a) the member registered a position, (b) the member's party
  had a strict majority position at the time of the vote, and (c) the vote was not
  procedural.
