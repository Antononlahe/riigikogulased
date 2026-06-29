-- packages/db/migrations/0020_member_expenses.sql
-- Per-MP expense compensations (kuluhüvitised): the annual reimbursement limit, how much was
-- spent, and the per-category split. Source: Riigikogu's published kuluhüvitised summaries
-- (koond_*.csv = limit + spent; liikide_*.csv = category breakdown), committed under
-- apps/scraper/cache/kuluhuvitised/. Joined to members by normalized full name (the CSV has no
-- DOB), so only members we already track get a row.
--
-- Additive only: no view touched, discipline/alignment unaffected. One row per (member, year).
-- The category split is kept as JSONB (display-only; we never sort/aggregate by category) so the
-- schema stays a single column instead of ten typed ones -- promote to columns if that changes.
BEGIN;

CREATE TABLE IF NOT EXISTS member_expenses (
  member_id  INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  year       INT  NOT NULL,
  limit_eur  NUMERIC(10,2) NOT NULL,        -- limiit
  spent_eur  NUMERIC(10,2) NOT NULL,        -- kulud (== liikide kokku)
  breakdown  JSONB NOT NULL DEFAULT '{}',   -- {category_key: amount} from liikide_*.csv
  PRIMARY KEY (member_id, year)
);

COMMIT;
