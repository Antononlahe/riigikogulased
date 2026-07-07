-- Site-wide speech search scans the whole 72k-speech corpus, not one member's slice. The
-- FTS arm is already GIN-indexed, but the ILIKE fallback (what makes inflected queries like
-- "koolide" match when the lemma index misses) was a seq scan over all speech text (~7s cold).
-- A trigram index makes that arm indexable too.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS member_speeches_text_trgm_idx
  ON member_speeches USING gin (text gin_trgm_ops);
