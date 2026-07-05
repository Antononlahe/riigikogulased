-- packages/db/migrations/0024_member_profiles.sql
-- Biographical CV data scraped from each member's public profile page (profile_parse). One
-- member_profiles row per member plus child tables for the multi-valued fields. Joined by
-- member_id (resolved from the profile UUID = members.riigikogu_id). Additive; discipline
-- scoring untouched.
--
-- Hobby/profession tags come from a committed one-time LLM pass (cache/profiles/profile_tags.json);
-- universities from a closed-set dictionary; birthplace lat/lon from the towns lookup. Workhorse
-- (bill counts) is NOT here: the profile page caps its bill lists at 3, so a real count needs a
-- separate crawl (deferred).
BEGIN;

CREATE TABLE IF NOT EXISTS member_profiles (
  member_id         INT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  birthplace_town   TEXT,
  birthplace_lat    NUMERIC(8,5),
  birthplace_lon    NUMERIC(8,5),
  children_count    INT,
  family_status_raw TEXT,
  profession_tag    TEXT,               -- LLM-assigned pre-politics profession bucket (nullable)
  scraped_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_hobbies (
  member_id INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  raw       TEXT NOT NULL,              -- the phrase as written ("tervislik eluviis")
  hobby_tag TEXT NOT NULL,              -- LLM-assigned bucket ("tervis"), 'Muu' if untagged
  PRIMARY KEY (member_id, raw)
);
CREATE INDEX IF NOT EXISTS member_hobbies_tag_idx ON member_hobbies (hobby_tag);

CREATE TABLE IF NOT EXISTS member_universities (
  member_id  INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  university TEXT NOT NULL,             -- canonical Estonian university name
  PRIMARY KEY (member_id, university)
);
CREATE INDEX IF NOT EXISTS member_universities_uni_idx ON member_universities (university);

-- NB: languages and honours are NOT modelled -- the profile pages do not carry those labels
-- (verified 0/124), so there is no data to store. Add tables here if the source ever exposes them.

CREATE TABLE IF NOT EXISTS member_caucuses (
  member_id INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL CHECK (kind IN ('friendship','cause')),
  name      TEXT NOT NULL,
  PRIMARY KEY (member_id, kind, name)
);
CREATE INDEX IF NOT EXISTS member_caucuses_kind_name_idx ON member_caucuses (kind, name);

COMMIT;
