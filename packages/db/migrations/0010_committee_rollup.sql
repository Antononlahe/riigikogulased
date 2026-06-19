-- packages/db/migrations/0010_committee_rollup.sql
-- v0.4-B/C/D committee cohesion: read-only views, mirroring the 0007 faction rollup.
--
-- IMPORTANT: the Riigikogu API exposes only committee *sitting/agenda* records and the
-- committee's aggregate decision (e.g. "FOR") -- never per-member roll-call ballots. So a
-- true "who-voted-how in committee" discipline does not exist in the source. What we can
-- measure honestly is COMMITTEE COHESION: the aggregate PLENARY discipline of the members
-- who currently sit on a committee. That is exactly the faction rollup, regrouped by
-- committee membership instead of by faction -- no new scoring.
--
-- Both views aggregate the member_discipline matview (124 rows; 0008) rather than the
-- 190k-row ballot_alignment, because committee cohesion = SUM(member counted/aligned) over
-- the committee's members -- byte-identical to a ballot rollup but trivially cheap, which
-- matters for the ~120 member-page builds that read committee_discipline.
--
-- Scoping: current, active committee membership (member_committee_terms.ended_on IS NULL).
-- Upgrade path (deferred): scope discipline to votes on bills that were actually on each
-- committee's agenda (committee sitting agendaItemDocuments -> draft_uuid -> votes), which
-- would make per-committee numbers domain-specific rather than a membership rollup.
BEGIN;

CREATE OR REPLACE VIEW committee_discipline AS
SELECT
  mct.committee_id,
  SUM(md.counted_votes)::bigint AS counted_votes,
  SUM(md.aligned_votes)::bigint AS aligned_votes,
  SUM(md.defections)::bigint    AS defections,
  COUNT(*)::int                 AS member_count
FROM member_committee_terms mct
JOIN members m           ON m.id = mct.member_id AND m.active
JOIN member_discipline md ON md.member_id = mct.member_id
WHERE mct.ended_on IS NULL
GROUP BY mct.committee_id;

-- One row per (committee, scoring party): powers the committee x party cohesion matrix.
-- Members grouped by their CURRENT party (member_current_party); committees are a
-- current-term construct, so current party is the right axis.
CREATE OR REPLACE VIEW committee_party_discipline AS
SELECT
  mct.committee_id,
  mcp.party_id,
  SUM(md.counted_votes)::bigint AS counted_votes,
  SUM(md.aligned_votes)::bigint AS aligned_votes,
  COUNT(*)::int                 AS member_count
FROM member_committee_terms mct
JOIN members m            ON m.id = mct.member_id AND m.active
JOIN member_discipline md  ON md.member_id = mct.member_id
JOIN member_current_party mcp ON mcp.member_id = mct.member_id
WHERE mct.ended_on IS NULL AND mcp.party_id IS NOT NULL
GROUP BY mct.committee_id, mcp.party_id;

COMMIT;
