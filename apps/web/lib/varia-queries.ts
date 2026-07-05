import { unstable_cache } from "next/cache";
import { pool } from "./db";
import type { AbsenceRow, GenRow, PartyWords } from "./varia";

/** Ghost-MP leaderboard: per member, the share of NON-procedural ballots they were absent for.
 *  Procedural votes (presence checks, agenda adoption) are excluded -- they'd swamp the signal.
 *  Members with fewer than 20 counted votes are floored out (too few to be meaningful). */
export const getAbsenceLeaderboard = unstable_cache(
  _getAbsenceLeaderboard,
  ["varia-absence"],
  { revalidate: 86400 },
);

async function _getAbsenceLeaderboard(): Promise<AbsenceRow[]> {
  const { rows } = await pool.query(`
    SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS "partyShortName",
           m.photo_thumb_path AS "photoThumbPath", m.active,
           count(*)::int AS total,
           count(*) FILTER (WHERE b.choice = 'absent')::int AS absent,
           round(100.0 * count(*) FILTER (WHERE b.choice = 'absent') / count(*), 1)::float AS "absentPct"
    FROM ballots b
    JOIN votes v ON v.id = b.vote_id
    JOIN members m ON m.id = b.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE v.vote_type_slug NOT IN (SELECT slug FROM procedural_vote_types)
    GROUP BY m.id, m.full_name, m.slug, mcp.party_short_name, m.photo_thumb_path, m.active
    HAVING count(*) >= 20
    ORDER BY "absentPct" DESC, m.full_name ASC
  `);
  return rows as AbsenceRow[];
}

/** Active members with a known birth date, for the generational stats. */
export const getMembersWithAge = unstable_cache(
  _getMembersWithAge,
  ["varia-generations"],
  { revalidate: 86400 },
);

async function _getMembersWithAge(): Promise<GenRow[]> {
  const { rows } = await pool.query(`
    SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS "partyShortName", m.photo_thumb_path AS "photoThumbPath",
           extract(year FROM m.date_of_birth)::int AS "birthYear",
           date_part('year', age(m.date_of_birth))::int AS age
    FROM members m
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE m.active AND m.date_of_birth IS NOT NULL
    ORDER BY m.date_of_birth ASC
  `);
  return rows as GenRow[];
}

/** Top signature words per party (scope 'party' in signature_terms), up to 15 each. */
export const getPartySignatureWords = unstable_cache(
  _getPartySignatureWords,
  ["varia-signatures"],
  { revalidate: 86400 },
);

async function _getPartySignatureWords(): Promise<PartyWords[]> {
  const { rows } = await pool.query(`
    SELECT p.short_name AS "partyShortName", st.lemma, st.score, st.rank
    FROM signature_terms st
    JOIN parties p ON p.id = st.scope_id
    WHERE st.scope_kind = 'party' AND st.rank <= 15
    ORDER BY p.short_name, st.rank
  `);
  const byParty = new Map<string, PartyWords>();
  for (const r of rows as { partyShortName: string; lemma: string; score: number; rank: number }[]) {
    let e = byParty.get(r.partyShortName);
    if (!e) {
      e = { partyShortName: r.partyShortName, words: [] };
      byParty.set(r.partyShortName, e);
    }
    e.words.push({ lemma: r.lemma, score: r.score, rank: r.rank });
  }
  return [...byParty.values()];
}
