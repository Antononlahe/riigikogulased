-- packages/db/migrations/0008_fast_discipline.sql
-- Point member_discipline at the ballot_alignment materialized view instead of the
-- member_vote_alignment view. member_vote_alignment recomputes party-at-time + party line
-- via correlated subqueries over every ballot; at full-XV scale (~190k ballots) the
-- homepage and faction-roster builds that aggregate it exceeded the 60s/page budget.
-- ballot_alignment is a cache of exactly those columns (refreshed after every ingest), so
-- this is the same result, just fast. The discipline DEFINITION is unchanged.
BEGIN;

CREATE OR REPLACE VIEW member_discipline AS
SELECT
  m.id AS member_id, m.full_name, m.slug,
  COUNT(*) FILTER (WHERE ba.party_majority_choice IS NOT NULL
    AND ba.member_choice IN ('yes','no','abstain') AND NOT ba.is_procedural) AS counted_votes,
  COUNT(*) FILTER (WHERE ba.party_majority_choice IS NOT NULL
    AND ba.member_choice IN ('yes','no','abstain') AND NOT ba.is_procedural
    AND ba.member_choice = ba.party_majority_choice) AS aligned_votes,
  COUNT(*) FILTER (WHERE ba.party_majority_choice IS NOT NULL
    AND ba.member_choice IN ('yes','no','abstain') AND NOT ba.is_procedural
    AND ba.member_choice <> ba.party_majority_choice) AS defections
FROM members m
LEFT JOIN ballot_alignment ba ON ba.member_id = m.id
GROUP BY m.id, m.full_name, m.slug;

COMMIT;
