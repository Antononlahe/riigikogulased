-- packages/db/migrations/0005_eurovoc.sql
-- Eurovoc subject taxonomy + bill->topic links. Topic-filtered discipline (D2) joins
-- member_vote_alignment to vote_topics. member_discipline is unchanged.
BEGIN;

CREATE TABLE IF NOT EXISTS eurovoc_fields (
  efid    INT PRIMARY KEY,
  uuid    UUID NOT NULL,
  code    TEXT,
  text_et TEXT NOT NULL,
  text_en TEXT
);
CREATE TABLE IF NOT EXISTS eurovoc_microthesauri (
  etid       INT PRIMARY KEY,
  uuid       UUID NOT NULL,
  code       TEXT,
  text_et    TEXT NOT NULL,
  text_en    TEXT,
  field_efid INT REFERENCES eurovoc_fields(efid)
);
CREATE TABLE IF NOT EXISTS eurovoc_descriptors (
  edid                INT PRIMARY KEY,
  uuid                UUID,
  code                TEXT,
  text_et             TEXT NOT NULL,
  text_en             TEXT,
  microthesaurus_etid INT REFERENCES eurovoc_microthesauri(etid)
);
CREATE TABLE IF NOT EXISTS volume_topics (
  draft_uuid      UUID NOT NULL,
  descriptor_edid INT NOT NULL REFERENCES eurovoc_descriptors(edid),
  PRIMARY KEY (draft_uuid, descriptor_edid)
);
CREATE INDEX IF NOT EXISTS volume_topics_descriptor_idx ON volume_topics (descriptor_edid);

CREATE OR REPLACE VIEW vote_topics AS
SELECT v.id AS vote_id, vt.descriptor_edid,
       d.microthesaurus_etid, mt.field_efid
FROM votes v
JOIN volume_topics vt ON vt.draft_uuid = v.draft_uuid
JOIN eurovoc_descriptors d ON d.edid = vt.descriptor_edid
LEFT JOIN eurovoc_microthesauri mt ON mt.etid = d.microthesaurus_etid;

COMMIT;
