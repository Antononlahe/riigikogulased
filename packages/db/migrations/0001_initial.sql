-- parteidistsipliin v0.1 schema.
--
-- Run with:  psql "$DATABASE_URL" -f packages/db/migrations/0001_initial.sql
--
-- This migration is idempotent: it can be rerun on an empty database. For the
-- v0.1 cut we don't have a migration framework — when we need 0002, add it as a
-- new file and start tracking history.

BEGIN;

CREATE TABLE IF NOT EXISTS parties (
  id          SERIAL PRIMARY KEY,
  short_name  TEXT NOT NULL UNIQUE,                 -- e.g. 'RE', 'EKRE'
  name        TEXT NOT NULL,                        -- e.g. 'Eesti Reformierakond'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id            SERIAL PRIMARY KEY,
  riigikogu_id  TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_party_terms (
  id          SERIAL PRIMARY KEY,
  member_id   INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  party_id    INT  REFERENCES parties(id),          -- NULL = unaffiliated
  started_on  DATE NOT NULL,
  ended_on    DATE,                                 -- NULL = current
  CHECK (ended_on IS NULL OR ended_on >= started_on)
);
CREATE INDEX IF NOT EXISTS member_party_terms_member_idx
  ON member_party_terms (member_id, started_on);

CREATE TABLE IF NOT EXISTS votes (
  id              SERIAL PRIMARY KEY,
  riigikogu_uuid  UUID NOT NULL UNIQUE,
  voted_at        TIMESTAMPTZ NOT NULL,
  title           TEXT NOT NULL,
  -- URL-derived category slug, e.g. 'kohalolekukontroll', 'paevakorra-kinnitamine',
  -- 'lopphaaletus'. See the `procedural_vote_types` table below for what gets
  -- excluded from discipline scoring.
  vote_type_slug  TEXT,
  agenda_item     TEXT,
  yes_count       INT NOT NULL DEFAULT 0,
  no_count        INT NOT NULL DEFAULT 0,
  abstain_count   INT NOT NULL DEFAULT 0,
  absent_count    INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS votes_voted_at_idx       ON votes (voted_at DESC);
CREATE INDEX IF NOT EXISTS votes_vote_type_slug_idx ON votes (vote_type_slug);

-- Single source of truth for "what counts as procedural".
-- To add a new procedural type, INSERT a row here and the discipline views adapt
-- automatically. Keep CLAUDE.md in sync.
CREATE TABLE IF NOT EXISTS procedural_vote_types (
  slug         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
);
INSERT INTO procedural_vote_types (slug, display_name) VALUES
  ('kohalolekukontroll',  'Kohaloleku kontroll'),
  ('paevakorra-kinnitamine', 'Päevakorra kinnitamine')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS ballots (
  vote_id    INT NOT NULL REFERENCES votes(id)   ON DELETE CASCADE,
  member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  choice     TEXT NOT NULL CHECK (choice IN ('yes','no','abstain','absent','neutral')),
  PRIMARY KEY (vote_id, member_id)
);
CREATE INDEX IF NOT EXISTS ballots_member_idx ON ballots (member_id);

-- --------------------------------------------------------------------------
-- Discipline views.
--
-- See CLAUDE.md > "Core metric" for the definition. In short:
--   * party majority is the strict-majority position among the member's faction,
--     EXCLUDING the member's own vote (so a tied party doesn't auto-align);
--   * 'absent' member ballots and 'no clear majority' party positions are
--     excluded from the score (NULL aligned), so the denominator is "votes
--     where a signal exists".
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW member_current_party AS
SELECT DISTINCT ON (mpt.member_id)
  mpt.member_id,
  mpt.party_id,
  p.short_name AS party_short_name,
  p.name       AS party_name
FROM member_party_terms mpt
LEFT JOIN parties p ON p.id = mpt.party_id
WHERE mpt.ended_on IS NULL OR mpt.ended_on > CURRENT_DATE
ORDER BY mpt.member_id, mpt.started_on DESC;

CREATE OR REPLACE VIEW member_vote_alignment AS
WITH ballots_with_party AS (
  SELECT
    b.vote_id,
    b.member_id,
    b.choice,
    mpt.party_id,
    -- Procedural votes (presence check, agenda adoption, ...) are filtered out of
    -- the discipline score. They're still visible elsewhere (counts, per-vote views).
    (v.vote_type_slug IN (SELECT slug FROM procedural_vote_types)) AS is_procedural
  FROM ballots b
  JOIN votes v ON v.id = b.vote_id
  JOIN member_party_terms mpt
    ON mpt.member_id   = b.member_id
   AND mpt.started_on <= v.voted_at::date
   AND (mpt.ended_on IS NULL OR mpt.ended_on > v.voted_at::date)
  WHERE mpt.party_id IS NOT NULL
),
party_totals AS (
  SELECT
    vote_id,
    party_id,
    COUNT(*) FILTER (WHERE choice = 'yes')                      AS yes_n,
    COUNT(*) FILTER (WHERE choice = 'no')                       AS no_n,
    COUNT(*) FILTER (WHERE choice = 'abstain')                  AS abstain_n,
    COUNT(*) FILTER (WHERE choice IN ('yes','no','abstain'))    AS registered_n
  FROM ballots_with_party
  GROUP BY vote_id, party_id
)
SELECT
  bwp.vote_id,
  bwp.member_id,
  bwp.party_id,
  bwp.choice AS member_choice,
  bwp.is_procedural,
  -- Strict majority excluding self.
  CASE
    WHEN (pt.yes_n     - CASE WHEN bwp.choice = 'yes'     THEN 1 ELSE 0 END) * 2
       > (pt.registered_n - CASE WHEN bwp.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'yes'
    WHEN (pt.no_n      - CASE WHEN bwp.choice = 'no'      THEN 1 ELSE 0 END) * 2
       > (pt.registered_n - CASE WHEN bwp.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'no'
    WHEN (pt.abstain_n - CASE WHEN bwp.choice = 'abstain' THEN 1 ELSE 0 END) * 2
       > (pt.registered_n - CASE WHEN bwp.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'abstain'
    ELSE NULL
  END AS party_majority_choice
FROM ballots_with_party bwp
JOIN party_totals pt USING (vote_id, party_id);

CREATE OR REPLACE VIEW member_discipline AS
SELECT
  m.id        AS member_id,
  m.full_name,
  m.slug,
  COUNT(*) FILTER (
    WHERE mva.party_majority_choice IS NOT NULL
      AND mva.member_choice IN ('yes','no','abstain')
      AND NOT mva.is_procedural
  ) AS counted_votes,
  COUNT(*) FILTER (
    WHERE mva.party_majority_choice IS NOT NULL
      AND mva.member_choice IN ('yes','no','abstain')
      AND NOT mva.is_procedural
      AND mva.member_choice = mva.party_majority_choice
  ) AS aligned_votes,
  COUNT(*) FILTER (
    WHERE mva.party_majority_choice IS NOT NULL
      AND mva.member_choice IN ('yes','no','abstain')
      AND NOT mva.is_procedural
      AND mva.member_choice <> mva.party_majority_choice
  ) AS defections
FROM members m
LEFT JOIN member_vote_alignment mva ON mva.member_id = m.id
GROUP BY m.id, m.full_name, m.slug;

-- --------------------------------------------------------------------------
-- Seed: current Riigikogu factions (as of XV koosseis, April 2023).
-- Scraper will keep these up to date; pre-seeding makes a fresh db boot cleaner.
-- --------------------------------------------------------------------------

INSERT INTO parties (short_name, name) VALUES
  ('RE',   'Eesti Reformierakond'),
  ('EKRE', 'Eesti Konservatiivne Rahvaerakond'),
  ('KE',   'Eesti Keskerakond'),
  ('E200', 'Erakond Eesti 200'),
  ('SDE',  'Sotsiaaldemokraatlik Erakond'),
  ('I',    'Erakond Isamaa')
ON CONFLICT (short_name) DO NOTHING;

COMMIT;
