-- packages/db/migrations/0015_election.sql
-- Election results: per-MP personal votes + how they won their seat.
--
-- Source: RIA election open data (opendata.valimised.ee/api/RK_2023/RESULTS.xml +
-- ELECTION_CANDIDATES.xml). For each elected MP: personal votes received, electoral
-- district, the d'Hondt quota, and the explicit mandateType -- PERSONAL (won a full quota
-- alone), DISTRICT (district mandate), or COMPENSATION (came in off the national list).
-- Joined to members by name + date_of_birth (same key as the äriregister erakond source).
--
-- Additive only: no view touched, discipline/alignment unaffected. One row per
-- (member, election); election_code (e.g. 'RK_2023') leaves room to backfill earlier terms.
BEGIN;

CREATE TABLE IF NOT EXISTS member_election_results (
  member_id       INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  election_code   TEXT NOT NULL,                 -- 'RK_2023', 'RK_2019', ...
  party_code      TEXT,                          -- election party code (informational)
  district_number INT,
  personal_votes  INT  NOT NULL,
  quota           NUMERIC(8,4),                  -- votes / district quota; >=1.0 == personal mandate
  mandate_type    TEXT NOT NULL CHECK (mandate_type IN ('PERSONAL', 'DISTRICT', 'COMPENSATION')),
  PRIMARY KEY (member_id, election_code)
);

COMMIT;
