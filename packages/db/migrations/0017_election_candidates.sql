-- v0.x: candidates who WON a mandate in the election but never took a Riigikogu seat.
-- The classic case is Mihhail Kõlvart (14592 personal votes, elected, stayed Tallinn mayor);
-- also ministers / MEPs who won a seat and declined it. These people have no `members` row
-- (they never sat), so they cannot live in member_election_results (member_id NOT NULL).
-- Only elected=true candidates with no sitting-member match are stored here ("would've been in"
-- but isn't) -- the long tail of non-elected, low-vote candidates is intentionally excluded.
-- Source: RIA election open data (same XMLs as member_election_results). Additive; no view,
-- no scoring change.
CREATE TABLE IF NOT EXISTS election_candidates (
  election_code   TEXT NOT NULL,
  app_id          INT  NOT NULL,             -- RIA applicationId (stable per candidate)
  forename        TEXT NOT NULL,
  surname         TEXT NOT NULL,
  party_code      TEXT,
  district_number INT,
  personal_votes  INT  NOT NULL,
  mandate_type    TEXT,
  PRIMARY KEY (election_code, app_id)
);
