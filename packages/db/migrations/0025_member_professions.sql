-- packages/db/migrations/0025_member_professions.sql
-- Multi-valued pre-politics professions. member_profiles.profession_tag held ONE LLM bucket per
-- member, which lost nuance and often latched onto an unrepresentative early job (e.g. a 3-year
-- first role over a 20-year career). This child table lets a member carry several profession tags
-- (like member_hobbies / member_universities). profession_tag stays as the primary/first tag for
-- backward compatibility; the web reads member_professions. Additive; discipline scoring untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS member_professions (
  member_id      INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  profession_tag TEXT NOT NULL,
  PRIMARY KEY (member_id, profession_tag)
);
CREATE INDEX IF NOT EXISTS member_professions_tag_idx ON member_professions (profession_tag);

COMMIT;
