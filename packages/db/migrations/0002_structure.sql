-- parteidistsipliin v0.2 / A2 structural schema.
-- Run with:  psql "$DATABASE_URL" -f packages/db/migrations/0002_structure.sql
-- Idempotent: safe to rerun. Does NOT touch the discipline views from 0001.

BEGIN;

-- Migration version tracking (introduced now; backfills 0001 retroactively).
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('0001'), ('0002')
  ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS riigikogu_terms (
  id         SERIAL PRIMARY KEY,
  number     INT  NOT NULL UNIQUE,           -- koosseis number, e.g. 15
  started_on DATE,
  ended_on   DATE
);
INSERT INTO riigikogu_terms (number, started_on) VALUES (15, DATE '2023-04-10')
  ON CONFLICT (number) DO NOTHING;

CREATE TABLE IF NOT EXISTS sessions (        -- istungjärk
  id         SERIAL PRIMARY KEY,
  term_id    INT  NOT NULL REFERENCES riigikogu_terms(id),
  number     INT  NOT NULL,
  type_code  TEXT NOT NULL,                  -- KORRALINE | ERAKORRALINE
  started_on DATE NOT NULL,
  ended_on   DATE,
  UNIQUE (term_id, number)
);
CREATE INDEX IF NOT EXISTS sessions_term_idx ON sessions (term_id);

CREATE TABLE IF NOT EXISTS sittings (        -- istung
  id             SERIAL PRIMARY KEY,
  riigikogu_uuid UUID NOT NULL UNIQUE,
  session_id     INT  REFERENCES sessions(id),
  term_id        INT  REFERENCES riigikogu_terms(id),
  title          TEXT,
  sitting_date   DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS sittings_session_idx ON sittings (session_id);
CREATE INDEX IF NOT EXISTS sittings_date_idx    ON sittings (sitting_date);

CREATE TABLE IF NOT EXISTS committees (
  id             SERIAL PRIMARY KEY,
  riigikogu_uuid UUID NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  type_code      TEXT NOT NULL               -- ALALINE_KOMISJON | ERIKOMISJON
);

CREATE TABLE IF NOT EXISTS member_committee_terms (
  id           SERIAL PRIMARY KEY,
  member_id    INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  committee_id INT  NOT NULL REFERENCES committees(id),
  role_code    TEXT,
  started_on   DATE,
  ended_on     DATE,
  UNIQUE (member_id, committee_id, started_on)
);
CREATE INDEX IF NOT EXISTS member_committee_terms_member_idx
  ON member_committee_terms (member_id);

CREATE TABLE IF NOT EXISTS electoral_districts (
  id   SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                  -- JARVA_JA_VILJANDIMAA
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS member_district_terms (
  id          SERIAL PRIMARY KEY,
  member_id   INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  district_id INT NOT NULL REFERENCES electoral_districts(id),
  term_id     INT NOT NULL REFERENCES riigikogu_terms(id),
  UNIQUE (member_id, district_id, term_id)
);
CREATE INDEX IF NOT EXISTS member_district_terms_member_idx
  ON member_district_terms (member_id);

-- Member enrichment.
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth             DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_death             DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS gender                    TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS email                     TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone                     TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS parliament_seniority_days INT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS mandate_started_on        DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_uuid                UUID;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_file_name           TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_url                 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_thumb_path          TEXT;

-- Vote enrichment.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS sitting_id  INT REFERENCES sittings(id);
ALTER TABLE votes ADD COLUMN IF NOT EXISTS draft_uuid  UUID;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS draft_title TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS draft_mark  TEXT;
CREATE INDEX IF NOT EXISTS votes_sitting_idx ON votes (sitting_id);
CREATE INDEX IF NOT EXISTS votes_draft_idx   ON votes (draft_uuid);

COMMIT;
