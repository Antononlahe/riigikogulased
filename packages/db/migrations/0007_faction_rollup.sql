-- packages/db/migrations/0007_faction_rollup.sql
-- v0.4-A faction rollups: read-only views for the faction comparison/detail pages.
--
-- faction_discipline aggregates the ballot_alignment matview (the cache of
-- member_vote_alignment) by party_id, using the EXACT member_discipline predicate. So
-- "faction cohesion" = aggregate faction discipline -- no new scoring, just a roll-up.
--
-- faction_attendance is a separate aggregate over ALL ballots (including procedural /
-- presence checks, which ballot_alignment excludes), attributing each ballot to the
-- member's faction-at-time via member_faction_terms. present = choice <> 'absent'.
BEGIN;

CREATE OR REPLACE VIEW faction_discipline AS
SELECT
  party_id,
  COUNT(*) FILTER (WHERE party_majority_choice IS NOT NULL
    AND member_choice IN ('yes','no','abstain') AND NOT is_procedural) AS counted_votes,
  COUNT(*) FILTER (WHERE party_majority_choice IS NOT NULL
    AND member_choice IN ('yes','no','abstain') AND NOT is_procedural
    AND member_choice = party_majority_choice) AS aligned_votes,
  COUNT(*) FILTER (WHERE party_majority_choice IS NOT NULL
    AND member_choice IN ('yes','no','abstain') AND NOT is_procedural
    AND member_choice <> party_majority_choice) AS defections
FROM ballot_alignment
-- ballot_alignment.party_id is never NULL (member_vote_alignment filters scoring_party_id
-- IS NOT NULL), but guard defensively and symmetrically with faction_attendance below.
WHERE party_id IS NOT NULL
GROUP BY party_id;

CREATE OR REPLACE VIEW faction_attendance AS
SELECT
  mft.party_id,
  -- present = any choice other than 'absent' (includes 'neutral' / "did not vote": present
  -- in the chamber but cast no ballot). Matches the spec's present = choice <> 'absent'.
  COUNT(*) FILTER (WHERE b.choice <> 'absent') AS present_ballots,
  COUNT(*)                                     AS total_ballots
FROM ballots b
JOIN votes v ON v.id = b.vote_id
JOIN member_faction_terms mft
  ON mft.member_id = b.member_id
 AND mft.started_on <= v.voted_at::date
 AND (mft.ended_on IS NULL OR mft.ended_on > v.voted_at::date)
WHERE mft.party_id IS NOT NULL
GROUP BY mft.party_id;

COMMIT;
