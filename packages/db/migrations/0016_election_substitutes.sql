-- packages/db/migrations/0016_election_substitutes.sql
-- Extend election results to non-elected candidates who are nonetheless sitting MPs --
-- substitutes (asendusliikmed) who took a seat vacated by an elected MP. They have personal
-- votes but no mandate, so mandate_type becomes nullable and an `elected` flag is added.
-- Existing rows (0015) are all elected winners.
BEGIN;

ALTER TABLE member_election_results ADD COLUMN IF NOT EXISTS elected BOOLEAN;
UPDATE member_election_results SET elected = true WHERE elected IS NULL;
ALTER TABLE member_election_results ALTER COLUMN elected SET NOT NULL;
-- Non-elected candidates have no mandate. (The CHECK already passes NULL.)
ALTER TABLE member_election_results ALTER COLUMN mandate_type DROP NOT NULL;

COMMIT;
