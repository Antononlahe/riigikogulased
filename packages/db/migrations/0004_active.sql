-- packages/db/migrations/0004_active.sql
-- Mark whether a member is currently sitting. Members present only via votings (voted this
-- term but absent from /api/plenary-members) are inactive; the discipline metric is unchanged.
BEGIN;
ALTER TABLE members ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
COMMIT;
