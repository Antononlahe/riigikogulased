-- Per-member attendance, mirroring faction_attendance (0007) but grouped by member.
-- present = any choice other than 'absent' (PUUDUB); 'neutral' ("did not vote" but in the
-- chamber) counts as present. Denominator is all of the member's ballots (only votings they
-- were on the roster for exist as ballots, so this is naturally tenure-bounded). Includes
-- procedural / presence-check ballots, consistent with faction_attendance.
CREATE OR REPLACE VIEW member_attendance AS
SELECT
  b.member_id,
  COUNT(*) FILTER (WHERE b.choice <> 'absent') AS present_ballots,
  COUNT(*)                                     AS total_ballots
FROM ballots b
GROUP BY b.member_id;
