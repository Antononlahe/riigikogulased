-- packages/db/migrations/0011_speech_stats.sql
-- v0.5-A/B speeches: store the API's PRE-COMPUTED per-member speech statistics.
--
-- Source: GET /api/statistics/speeches/plenary?startDate=&endDate= returns, in one call,
-- every active member's speech counts for the window (speeches / questions / procedural /
-- total). The API does not expose word counts or per-speech Eurovoc topics here, so the
-- storybook's word totals / cadence sparkline / topic treemap are out of scope for this
-- MVP -- they would need full /api/steno ingestion. Counts are enough to ship the
-- leaderboard (A) and the per-member panel (B).
BEGIN;

CREATE TABLE IF NOT EXISTS member_speech_stats (
  member_id    INT  PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  speeches     INT  NOT NULL DEFAULT 0,   -- kõned (floor speeches)
  questions    INT  NOT NULL DEFAULT 0,   -- küsimused
  procedural   INT  NOT NULL DEFAULT 0,   -- protseduurilised
  total        INT  NOT NULL DEFAULT 0,
  period_start DATE,
  period_end   DATE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
