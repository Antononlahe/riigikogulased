-- packages/db/migrations/0013_speech_sitting_type.sql
-- v0.5 speech search polish: record each speech's sitting type (istung / infotund /
-- erakorraline / taiendav / eri), derived from the verbatim sitting title, so the search
-- UI can label the context (e.g. an Infotund question topic vs a plenary bill reading).
-- agenda_title is also stored HTML-stripped now (the API wraps many in <p>...</p>).
BEGIN;

ALTER TABLE member_speeches ADD COLUMN IF NOT EXISTS sitting_type TEXT;

COMMIT;
