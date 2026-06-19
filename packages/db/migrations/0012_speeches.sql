-- packages/db/migrations/0012_speeches.sql
-- v0.5 stenogram search: per-MP speech text, searchable with Estonian lemma-aware FTS.
--
-- Source: /api/steno/verbatims (whole-sitting transcripts). Each SPEECH event carries a
-- speaker name, text, timestamp, agenda item, and a stenogrammid.riigikogu.ee link. The
-- speaker is matched to a member by name in the scraper (verbatim_parse).
--
-- NOTE: a verbatim event's `uuid` is the SPEAKER's person id (repeated across all their
-- speeches, sometimes null) -- NOT a per-utterance id. So the stable per-speech key is a
-- content hash (sha1 of sitting link + timestamp + speaker + text head), computed at ingest;
-- `speaker_uuid` is kept only as informational provenance.
--
-- Search quality: Estonian is heavily inflected and Postgres has no Estonian stemmer, and
-- Neon (managed) forbids installing custom Ispell/Hunspell dictionaries. So we lemmatize at
-- ingest with Vabamorf/EstNLTK (in the Python scraper) and store space-joined base-form
-- lemmas; the tsvector is built with the built-in `simple` config (no dictionary needed).
-- Querying the lemma vector collapses inflections (koolis/koolide -> kool). pg_trgm gives a
-- fuzzy fallback over the raw text for typos / partial words / un-lemmatized queries.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS member_speeches (
  id           BIGSERIAL PRIMARY KEY,
  member_id    INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  speech_key   TEXT NOT NULL UNIQUE,         -- sha1(link|ts|speaker|text head); idempotent re-ingest
  speaker_uuid UUID,                          -- the verbatim event's speaker id (provenance only)
  spoken_at    TIMESTAMPTZ,
  sitting_date DATE,
  agenda_title TEXT,
  steno_link   TEXT,                          -- deep link to stenogrammid.riigikogu.ee
  text         TEXT NOT NULL,
  lemmas       TEXT,                           -- space-joined Vabamorf base forms of `text`
  search       TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(lemmas, ''))) STORED
);

CREATE INDEX IF NOT EXISTS member_speeches_member_idx ON member_speeches (member_id);
CREATE INDEX IF NOT EXISTS member_speeches_fts_idx    ON member_speeches USING gin (search);
CREATE INDEX IF NOT EXISTS member_speeches_trgm_idx   ON member_speeches USING gin (text gin_trgm_ops);

COMMIT;
