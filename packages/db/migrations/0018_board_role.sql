-- Riigikogu juhatus (board) role for the current term: ESIMEES (chair) or ASEESIMEES
-- (deputy chair), NULL for ordinary members. Sourced from /api/plenary-members
-- plenaryMembership.role; reflects the *current* holder (self-correcting when the board
-- changes), not historical board terms. Used only to show a context badge on the speech UI
-- (presiding officers' procedural remarks are filtered out of speech counts).
ALTER TABLE members ADD COLUMN IF NOT EXISTS board_role TEXT;
