-- Precompute per-speech word count so the /statistika speaker leaderboard stops tokenising
-- every speech's full text on every page render. The old query summed
-- array_length(string_to_array(btrim(text), ' '), 1) live across all ~62k speeches (~1.4s per
-- render, and the page renders dynamically so it paid this every load). As a STORED generated
-- column the value is computed once on write (and backfilled for existing rows by this ALTER),
-- so the leaderboard just SUM/AVGs an int (~15ms). Semantics are byte-identical to the old
-- expression, so displayed word totals are unchanged. NULL for empty text, same as before.
ALTER TABLE member_speeches
  ADD COLUMN IF NOT EXISTS word_count int
  GENERATED ALWAYS AS (array_length(string_to_array(btrim(text), ' '), 1)) STORED;
