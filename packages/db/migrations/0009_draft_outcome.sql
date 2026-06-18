-- packages/db/migrations/0009_draft_outcome.sql
-- Bill (eelnõu/draft) final outcome, straight from the Riigikogu draft endpoint
-- (/api/volumes/drafts/{uuid}). This is the bill's authoritative fate as recorded by
-- Riigikogu, so it sidesteps the per-voting majority-threshold problem entirely:
-- we never compute pass/fail ourselves.
--
-- Keyed by draft_uuid (= votes.draft_uuid). One row per bill; many votes share a bill.
-- A deliberately minimal precursor to the v0.6 `volumes` table — only the outcome fields,
-- no full dossier model. Populated by the `drafts` CLI command (and the `eurovoc` run).
BEGIN;

CREATE TABLE IF NOT EXISTS draft_outcomes (
  draft_uuid   UUID PRIMARY KEY,
  -- activeDraftStage: the bill's overall stage. Terminal values are VASTU_VOETUD
  -- (adopted), TAGASI_LYKATUD (rejected), TAGASI_VOETUD (withdrawn); a reading stage
  -- (TEINE_LUGEMINE / KOLMAS_LUGEMINE) means still in process.
  stage        TEXT,
  -- activeDraftStatus: finer status, e.g. AVALDATUD_RIIGITEATAJAS (published in the
  -- State Gazette), VALJAKUULUTATUD (proclaimed), SAADETUD_VABARIIGI_PRESIDENDILE.
  status       TEXT,
  accepted_on  DATE,                                  -- draft `accepted` (adoption date)
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
