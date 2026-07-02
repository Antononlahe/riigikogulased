-- packages/db/migrations/0022_decisive.sql
-- "Decisive votes": did voting against the fraktsioon line ever change an outcome?
--
-- votes.required_majority: the passage rule, derived at ingest by
-- api_parse.required_majority (the API does not expose it):
--   'simple'  - poolthäälteenamus, yes > no (the default)
--   'members' - koosseisu häälteenamus, >= 51 yes of 101: umbusaldusavaldus (PS §97),
--               Riigikogu otsus making a proposal to the Government (RKKTS §154 lg 2),
--               immunity waivers (PS §76), final votes on PS §104 constitutional-class laws.
-- votes.document_title: relatedDocument title (umbusaldus votings carry no draft, only
-- a document; without this the vote's subject would be invisible).
--
-- vote_decisiveness: one row per non-procedural vote. Counterfactual = every defector
-- (member whose ballot differs from their party line, per ballot_alignment) votes the
-- line instead; cf_* are the resulting counts. passed <> cf_passed means the defections
-- flipped the outcome. flip_gap is the number of yes-ballot changes that would flip the
-- actual outcome (a closeness measure for the "almost decisive" list).
-- Reads the ballot_alignment MATERIALIZED VIEW, so it is fast and refreshes with it.
-- Backfill of the two columns for pre-0022 rows is done by replaying the votings cache
-- (rebuild does this; prod was backfilled once from cache/api/votings.jsonl).

BEGIN;

ALTER TABLE votes ADD COLUMN IF NOT EXISTS required_majority TEXT NOT NULL DEFAULT 'simple'
  CHECK (required_majority IN ('simple', 'members'));
ALTER TABLE votes ADD COLUMN IF NOT EXISTS document_title TEXT;

CREATE OR REPLACE VIEW vote_decisiveness AS
WITH defection AS (
  SELECT
    ba.vote_id,
    COUNT(*)::int                                            AS defections,
    COUNT(*) FILTER (WHERE ba.member_choice = 'yes')::int    AS def_yes,
    COUNT(*) FILTER (WHERE ba.member_choice = 'no')::int     AS def_no,
    COUNT(*) FILTER (WHERE ba.party_majority_choice = 'yes')::int AS line_yes,
    COUNT(*) FILTER (WHERE ba.party_majority_choice = 'no')::int  AS line_no
  FROM ballot_alignment ba
  WHERE NOT ba.is_procedural
    AND ba.member_choice IN ('yes', 'no', 'abstain')
    AND ba.party_majority_choice IS NOT NULL
    AND ba.member_choice <> ba.party_majority_choice
  GROUP BY ba.vote_id
)
SELECT
  v.id                                   AS vote_id,
  v.voted_at,
  v.title,
  v.draft_title,
  v.document_title,
  v.required_majority,
  v.yes_count,
  v.no_count,
  v.abstain_count,
  COALESCE(d.defections, 0)              AS defections,
  v.yes_count - COALESCE(d.def_yes, 0) + COALESCE(d.line_yes, 0) AS cf_yes_count,
  v.no_count  - COALESCE(d.def_no, 0)  + COALESCE(d.line_no, 0)  AS cf_no_count,
  CASE WHEN v.required_majority = 'members'
       THEN v.yes_count >= 51
       ELSE v.yes_count > v.no_count END AS passed,
  CASE WHEN v.required_majority = 'members'
       THEN v.yes_count - COALESCE(d.def_yes, 0) + COALESCE(d.line_yes, 0) >= 51
       ELSE v.yes_count - COALESCE(d.def_yes, 0) + COALESCE(d.line_yes, 0)
          > v.no_count  - COALESCE(d.def_no, 0)  + COALESCE(d.line_no, 0) END AS cf_passed,
  CASE WHEN v.required_majority = 'members'
       THEN CASE WHEN v.yes_count >= 51 THEN v.yes_count - 50 ELSE 51 - v.yes_count END
       ELSE CASE WHEN v.yes_count > v.no_count
                 THEN v.yes_count - v.no_count
                 ELSE v.no_count - v.yes_count + 1 END END AS flip_gap
FROM votes v
LEFT JOIN defection d ON d.vote_id = v.id
WHERE v.vote_type_slug NOT IN (SELECT slug FROM procedural_vote_types);

COMMIT;
