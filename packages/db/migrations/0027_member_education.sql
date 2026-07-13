-- packages/db/migrations/0027_member_education.sql
-- Store the raw education CV text on member_profiles. member_universities holds the *derived*
-- higher-ed institutions, but the "Pole kõrgkoolis käinud" grouping needs to tell "has an
-- education listed but no higher-ed institution" (the 5 gümnaasium/tehnikum-only members) apart
-- from "no education text at all" (unknown) -- which needs the raw presence. Additive, nullable.
BEGIN;

ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS education_raw TEXT;

COMMIT;
