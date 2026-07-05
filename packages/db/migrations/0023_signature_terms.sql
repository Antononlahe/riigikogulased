-- packages/db/migrations/0023_signature_terms.sql
-- Precomputed "signature words": the most distinctive lemmas for each member and each party,
-- ranked by TF-IDF over member_speeches.lemmas. A cache like ballot_alignment / member_expenses:
-- the web reads the top-N per scope instead of running TF-IDF at request time.
--
-- Recomputed by the `signatures` CLI (offline, from member_speeches) and in rebuild, after any
-- ingest that adds stenogram speeches. Additive: no view or existing table is touched, and it
-- has nothing to do with discipline scoring.
BEGIN;

CREATE TABLE IF NOT EXISTS signature_terms (
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('member','party')),
  scope_id   INT  NOT NULL,          -- members.id or parties.id, per scope_kind
  lemma      TEXT NOT NULL,
  score      REAL NOT NULL,          -- tf-idf weight
  rank       INT  NOT NULL,          -- 1..N within the scope, by score desc
  PRIMARY KEY (scope_kind, scope_id, lemma)
);
CREATE INDEX IF NOT EXISTS signature_terms_scope_idx
  ON signature_terms (scope_kind, scope_id, rank);

COMMIT;
