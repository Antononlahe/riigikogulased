import { unstable_cache } from "next/cache";
import { pool } from "./db";
import type {
  AbsenceRow, GenRow, PartyWords, MemberWord,
  PeopleRow, ChildRow, BirthPin, CaucusMember,
} from "./varia";

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

/** Each active member's top-3 signature words (rank 1..3), members ordered by their rank-1
 *  distinctiveness. The board (speaker + deputies) is excluded: presiding speech is pure plenary
 *  procedure, so their "signature" word is always chair boilerplate no matter how long the manual
 *  exclude list grows. */
export const getMemberSignatureWords = unstable_cache(
  async (): Promise<MemberWord[]> => {
    const { rows } = await pool.query(`
      SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
             mcp.party_short_name AS party, st.lemma, st.rank, st.score
      FROM signature_terms st
      JOIN members m ON m.id = st.scope_id
      LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE st.scope_kind = 'member' AND st.rank <= 3 AND m.active AND m.board_role IS NULL`);
    // Group ranks 1..3 per member; order members by their rank-1 score (highest = most distinctive).
    const byId = new Map<number, MemberWord & { score1: number }>();
    for (const r of rows as {
      memberId: number; fullName: string; slug: string; party: string | null;
      lemma: string; rank: number; score: number;
    }[]) {
      let e = byId.get(r.memberId);
      if (!e) {
        e = { memberId: r.memberId, fullName: r.fullName, slug: r.slug, party: r.party, words: [], score1: 0 };
        byId.set(r.memberId, e);
      }
      e.words.push({ lemma: r.lemma, rank: r.rank });
      if (r.rank === 1) e.score1 = r.score;
    }
    return [...byId.values()]
      .sort((a, b) => b.score1 - a.score1 || a.fullName.localeCompare(b.fullName, "et"))
      .map(({ score1: _score1, ...m }) => ({ ...m, words: m.words.sort((x, y) => x.rank - y.rank) }));
  },
  ["varia-member-signatures"],
  { revalidate: 86400 },
);

// --- Phase 1: biographical stats (member_profiles + child tables). Each returns [] on error /
// before the tables are populated, so the pages render an empty state. ---

// Each people section fetches flat (category, member) rows -- the client groups them so
// expanding a category reveals its members without another round-trip (same idea as caucuses).

export const getHobbyMembers = unstable_cache(async (): Promise<PeopleRow[]> => {
  const { rows } = await pool.query(`
    SELECT DISTINCT h.hobby_tag AS category, m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS party, NULL::text AS detail
    FROM member_hobbies h
    JOIN members m ON m.id = h.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    ORDER BY category, "fullName"`);
  return rows as PeopleRow[];
}, ["varia-hobby-members"], { revalidate: 86400 });

export const getUniversityMembers = unstable_cache(async (): Promise<PeopleRow[]> => {
  const { rows } = await pool.query(`
    SELECT DISTINCT u.university AS category, m.full_name AS "fullName", m.slug,
           mcp.party_short_name AS party, NULL::text AS detail
    FROM member_universities u
    JOIN members m ON m.id = u.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    ORDER BY category, "fullName"`);
  return rows as PeopleRow[];
}, ["varia-university-members"], { revalidate: 86400 });

export const getChildren = unstable_cache(async (): Promise<ChildRow[]> => {
  // All active members: those with a stated children count first (most first), then members whose
  // profile states no number (children = null -> shown as 0, listed last, name-ordered).
  const { rows } = await pool.query(`
    SELECT m.full_name AS "fullName", m.slug, mcp.party_short_name AS "partyShortName",
           m.photo_thumb_path AS "photoThumbPath", mp.children_count AS children
    FROM members m
    LEFT JOIN member_profiles mp ON mp.member_id = m.id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE m.active
    ORDER BY mp.children_count DESC NULLS LAST, m.full_name`);
  return rows as ChildRow[];
}, ["varia-children"], { revalidate: 86400 });

export const getBirthPins = unstable_cache(async (): Promise<BirthPin[]> => {
  const { rows } = await pool.query(`
    SELECT mp.birthplace_town AS town,
           mp.birthplace_lat::float AS lat, mp.birthplace_lon::float AS lon,
           json_agg(json_build_object('fullName', m.full_name, 'slug', m.slug, 'party', mcp.party_short_name)
                    ORDER BY m.full_name) AS members
    FROM member_profiles mp
    JOIN members m ON m.id = mp.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
    WHERE mp.birthplace_lat IS NOT NULL
    GROUP BY mp.birthplace_town, mp.birthplace_lat, mp.birthplace_lon`);
  return rows as BirthPin[];
}, ["varia-birthpins"], { revalidate: 86400 });

/** Every (caucus, member) row for a kind -- the client groups it by group / country / member so
 *  clicking any of the three reveals membership without another round-trip. */
async function _caucusMembers(kind: "friendship" | "cause"): Promise<CaucusMember[]> {
  const { rows } = await pool.query(`
    SELECT mc.name, m.full_name AS "fullName", m.slug, mcp.party_short_name AS party
    FROM member_caucuses mc
    JOIN members m ON m.id = mc.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = mc.member_id
    WHERE mc.kind = $1
    ORDER BY mc.name, m.full_name`, [kind]);
  return rows as CaucusMember[];
}

export const getFriendshipMembers = unstable_cache(() => _caucusMembers("friendship"),
  ["varia-friendship-members"], { revalidate: 86400 });
export const getCauseMembers = unstable_cache(() => _caucusMembers("cause"),
  ["varia-cause-members"], { revalidate: 86400 });
