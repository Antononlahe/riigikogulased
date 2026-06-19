-- packages/db/migrations/0014_drop_lemmas.sql
-- v0.5 speech search slimming: drop the redundant `lemmas` text column.
--
-- `search` was GENERATED from `lemmas` (which itself roughly duplicated `text`), so the
-- table stored text + lemmas + tsvector. We only ever query the tsvector, so: detach
-- `search` from its generation expression (keeping its existing values, no recompute) and
-- drop `lemmas`. Ingest now builds the tsvector inline via to_tsvector('simple', <lemmas>)
-- in db.upsert_speeches. Run VACUUM FULL afterwards (outside this txn) to reclaim the heap.
BEGIN;

ALTER TABLE member_speeches ALTER COLUMN search DROP EXPRESSION;
ALTER TABLE member_speeches DROP COLUMN IF EXISTS lemmas;

COMMIT;
