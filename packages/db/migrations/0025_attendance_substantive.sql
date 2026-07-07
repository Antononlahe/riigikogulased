-- member_attendance (0019) counted ALL ballots, including procedural votes (presence
-- checks, agenda adoption). That made the /saadikud "kohalolek" column rank members
-- differently from the varia "puudumised" leaderboard, which is substantive-only.
-- Redefine the view to exclude procedural votes so both surfaces use one definition:
-- share of NON-procedural ballots where the member was present ('neutral' = present).
CREATE OR REPLACE VIEW member_attendance AS
SELECT
  b.member_id,
  COUNT(*) FILTER (WHERE b.choice <> 'absent') AS present_ballots,
  COUNT(*)                                     AS total_ballots
FROM ballots b
JOIN votes v ON v.id = b.vote_id
WHERE v.vote_type_slug NOT IN (SELECT slug FROM procedural_vote_types)
GROUP BY b.member_id;
