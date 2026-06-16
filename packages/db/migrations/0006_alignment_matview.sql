-- packages/db/migrations/0006_alignment_matview.sql
-- Materialized cache of member_vote_alignment.
--
-- member_vote_alignment recomputes each ballot's party-at-time and party line via
-- correlated subqueries over the whole ballots table (~8s to materialize fully). The
-- homepage/member pages avoid the cost (one aggregate pass, or a member_id filter that
-- pushes down), but per-TOPIC discipline (v0.3/D2) joins the view to vote_topics by
-- vote_id, which the view cannot be filtered on -- so every topic page paid ~8s.
--
-- This caches the view's output, indexed by vote_id, so topic queries are sub-100ms. The
-- discipline DEFINITION is unchanged: this is a cache of the existing view, not new scoring.
-- The scraper refreshes it after each ingest that touches ballots/votes/faction/erakond
-- terms (db.refresh_alignment); `rebuild` creates it empty (migrations run before data is
-- written) and refreshes at the end.
BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS ballot_alignment AS
  SELECT vote_id, member_id, party_id, member_choice, is_procedural, party_majority_choice
  FROM member_vote_alignment;

-- One row per (vote, member); the unique index also serves the vote_id-leading topic
-- lookups and would permit a future CONCURRENTLY refresh.
CREATE UNIQUE INDEX IF NOT EXISTS ballot_alignment_vote_member_idx
  ON ballot_alignment (vote_id, member_id);

COMMIT;
