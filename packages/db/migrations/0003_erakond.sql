-- packages/db/migrations/0003_erakond.sql
-- v0.2 erakond/fraktsioon reconciliation.
--
-- Splits the conflated "party term" into:
--   * member_faction_terms  -- the fraktsioon a member sits in (party_id NULL = non-attached),
--                              renamed from member_party_terms (semantics unchanged).
--   * member_erakond_terms  -- party (erakond) membership from the aariregister registry.
-- Reworks the discipline views so the SCORING party is faction-first / erakond-fallback,
-- and the party LINE is defined by FACTION members only. See CLAUDE.md "Core metric".

BEGIN;

ALTER TABLE member_party_terms RENAME TO member_faction_terms;
ALTER INDEX member_party_terms_member_idx RENAME TO member_faction_terms_member_idx;

ALTER TABLE parties ADD COLUMN IF NOT EXISTS registry_code TEXT;
UPDATE parties SET registry_code = v.code FROM (VALUES
  ('RE','80043147'), ('EKRE','80040344'), ('KE','80034740'),
  ('E200','80529308'), ('SDE','80031010'), ('I','80042700')
) AS v(short, code) WHERE parties.short_name = v.short;

CREATE TABLE IF NOT EXISTS member_erakond_terms (
  id          SERIAL PRIMARY KEY,
  member_id   INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  party_id    INT  REFERENCES parties(id),
  started_on  DATE,
  ended_on    DATE,
  source      TEXT NOT NULL DEFAULT 'ariregister',
  CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);
CREATE INDEX IF NOT EXISTS member_erakond_terms_member_idx
  ON member_erakond_terms (member_id, started_on);

-- Rebuild the views fresh (definitions change, not just text).
DROP VIEW IF EXISTS member_discipline;
DROP VIEW IF EXISTS member_vote_alignment;
DROP VIEW IF EXISTS member_current_party;

-- Faction membership per ballot (party_id NOT NULL = sits in that faction).
CREATE VIEW member_vote_alignment AS
WITH faction_ballots AS (
  SELECT b.vote_id, b.member_id, b.choice, mft.party_id,
         (v.vote_type_slug IN (SELECT slug FROM procedural_vote_types)) AS is_procedural,
         v.voted_at::date AS vote_day
  FROM ballots b
  JOIN votes v ON v.id = b.vote_id
  JOIN member_faction_terms mft
    ON mft.member_id = b.member_id
   AND mft.started_on <= v.voted_at::date
   AND (mft.ended_on IS NULL OR mft.ended_on > v.voted_at::date)
  WHERE mft.party_id IS NOT NULL
),
party_line AS (
  SELECT vote_id, party_id,
    COUNT(*) FILTER (WHERE choice = 'yes')                   AS yes_n,
    COUNT(*) FILTER (WHERE choice = 'no')                    AS no_n,
    COUNT(*) FILTER (WHERE choice = 'abstain')               AS abstain_n,
    COUNT(*) FILTER (WHERE choice IN ('yes','no','abstain')) AS registered_n
  FROM faction_ballots
  GROUP BY vote_id, party_id
),
scoring AS (
  SELECT b.vote_id, b.member_id, b.choice,
         (v.vote_type_slug IN (SELECT slug FROM procedural_vote_types)) AS is_procedural,
         COALESCE(
           (SELECT mft.party_id FROM member_faction_terms mft
             WHERE mft.member_id = b.member_id
               AND mft.started_on <= v.voted_at::date
               AND (mft.ended_on IS NULL OR mft.ended_on > v.voted_at::date)
               AND mft.party_id IS NOT NULL
             ORDER BY mft.started_on DESC LIMIT 1),
           (SELECT met.party_id FROM member_erakond_terms met
             WHERE met.member_id = b.member_id
               AND met.party_id IS NOT NULL
               AND (met.started_on IS NULL OR met.started_on <= v.voted_at::date)
               AND (met.ended_on IS NULL OR met.ended_on > v.voted_at::date)
             ORDER BY met.started_on DESC NULLS LAST LIMIT 1)
         ) AS scoring_party_id,
         EXISTS (
           SELECT 1 FROM member_faction_terms mft
             WHERE mft.member_id = b.member_id
               AND mft.started_on <= v.voted_at::date
               AND (mft.ended_on IS NULL OR mft.ended_on > v.voted_at::date)
               AND mft.party_id IS NOT NULL
         ) AS in_faction
  FROM ballots b
  JOIN votes v ON v.id = b.vote_id
)
SELECT
  s.vote_id, s.member_id, s.scoring_party_id AS party_id, s.choice AS member_choice,
  s.is_procedural,
  CASE
    WHEN (pl.yes_n     - CASE WHEN s.in_faction AND s.choice = 'yes'     THEN 1 ELSE 0 END) * 2
       > (pl.registered_n - CASE WHEN s.in_faction AND s.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'yes'
    WHEN (pl.no_n      - CASE WHEN s.in_faction AND s.choice = 'no'      THEN 1 ELSE 0 END) * 2
       > (pl.registered_n - CASE WHEN s.in_faction AND s.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'no'
    WHEN (pl.abstain_n - CASE WHEN s.in_faction AND s.choice = 'abstain' THEN 1 ELSE 0 END) * 2
       > (pl.registered_n - CASE WHEN s.in_faction AND s.choice IN ('yes','no','abstain') THEN 1 ELSE 0 END)
      THEN 'abstain'
    ELSE NULL
  END AS party_majority_choice
FROM scoring s
JOIN party_line pl ON pl.vote_id = s.vote_id AND pl.party_id = s.scoring_party_id
WHERE s.scoring_party_id IS NOT NULL;

CREATE VIEW member_discipline AS
SELECT
  m.id AS member_id, m.full_name, m.slug,
  COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
    AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural) AS counted_votes,
  COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
    AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
    AND mva.member_choice = mva.party_majority_choice) AS aligned_votes,
  COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
    AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
    AND mva.member_choice <> mva.party_majority_choice) AS defections
FROM members m
LEFT JOIN member_vote_alignment mva ON mva.member_id = m.id
GROUP BY m.id, m.full_name, m.slug;

CREATE VIEW member_current_party AS
WITH cur_faction AS (
  SELECT DISTINCT ON (mft.member_id) mft.member_id, mft.party_id
  FROM member_faction_terms mft
  WHERE (mft.ended_on IS NULL OR mft.ended_on > CURRENT_DATE) AND mft.party_id IS NOT NULL
  ORDER BY mft.member_id, mft.started_on DESC
),
cur_erakond AS (
  SELECT DISTINCT ON (met.member_id) met.member_id, met.party_id
  FROM member_erakond_terms met
  WHERE (met.ended_on IS NULL OR met.ended_on > CURRENT_DATE) AND met.party_id IS NOT NULL
  ORDER BY met.member_id, met.started_on DESC NULLS LAST
)
SELECT
  m.id AS member_id,
  COALESCE(cf.party_id, ce.party_id) AS party_id,
  p.short_name AS party_short_name,
  p.name       AS party_name,
  (cf.party_id IS NOT NULL) AS in_faction
FROM members m
LEFT JOIN cur_faction cf ON cf.member_id = m.id
LEFT JOIN cur_erakond ce ON ce.member_id = m.id
LEFT JOIN parties p ON p.id = COALESCE(cf.party_id, ce.party_id);

COMMIT;
