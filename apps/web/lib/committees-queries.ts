import { pool } from "./db";
import { PARTY_ORDER, type PartyShort } from "./party";
import { committeeSlug, type CommitteeRow, type CommitteeMatrixCell } from "./committees";
import type { RosterMember } from "./factions";

/** One row per committee: cohesion counts + current member count. Powers the card grid (A). */
export async function getCommitteeComparison(): Promise<CommitteeRow[]> {
  const { rows } = await pool.query(`
    SELECT c.id AS "committeeId", c.name,
           COALESCE(cd.counted_votes, 0)::int AS counted,
           COALESCE(cd.aligned_votes, 0)::int AS aligned,
           COALESCE(cd.defections, 0)::int    AS defections,
           COALESCE(cd.member_count, 0)::int  AS "memberCount"
    FROM committees c
    JOIN committee_discipline cd ON cd.committee_id = c.id
    ORDER BY c.name
  `);
  return rows.map((r) => ({ ...r, slug: committeeSlug(r.name) })) as CommitteeRow[];
}

export type CommitteeMatrix = {
  committees: { committeeId: number; name: string; slug: string }[];
  parties: PartyShort[];
  cells: Record<number, Partial<Record<PartyShort, CommitteeMatrixCell>>>;
};

/** Committee x party cohesion cells for the matrix (B). */
export async function getCommitteeMatrix(): Promise<CommitteeMatrix> {
  const { rows } = await pool.query(`
    SELECT c.id AS "committeeId", c.name, p.short_name AS "partyShort",
           cpd.counted_votes::int AS counted, cpd.aligned_votes::int AS aligned,
           cpd.member_count::int AS "memberCount"
    FROM committee_party_discipline cpd
    JOIN committees c ON c.id = cpd.committee_id
    JOIN parties p ON p.id = cpd.party_id
    ORDER BY c.name
  `);
  const committees: CommitteeMatrix["committees"] = [];
  const seen = new Set<number>();
  const cells: CommitteeMatrix["cells"] = {};
  for (const r of rows) {
    if (!seen.has(r.committeeId)) {
      seen.add(r.committeeId);
      committees.push({ committeeId: r.committeeId, name: r.name, slug: committeeSlug(r.name) });
      cells[r.committeeId] = {};
    }
    if (PARTY_ORDER.includes(r.partyShort)) {
      cells[r.committeeId][r.partyShort as PartyShort] = {
        cohesion: r.counted > 0 ? r.aligned / r.counted : null,
        memberCount: r.memberCount,
      };
    }
  }
  return { committees, parties: PARTY_ORDER, cells };
}

export type CommitteeDetail = {
  committeeId: number;
  name: string;
  slug: string;
  counted: number;
  aligned: number;
  defections: number;
  memberCount: number;
  members: RosterMember[];
};

/** Header metrics + ranked roster for one committee, or null for an unknown slug. */
export async function getCommitteeDetail(slug: string): Promise<CommitteeDetail | null> {
  // 15 committees: resolve the slug in JS rather than slugifying in SQL.
  const { rows: all } = await pool.query<{ id: number; name: string }>(
    "SELECT id, name FROM committees",
  );
  const match = all.find((c) => committeeSlug(c.name) === slug);
  if (!match) return null;

  const headerRes = await pool.query(
    `SELECT COALESCE(cd.counted_votes,0)::int AS counted,
            COALESCE(cd.aligned_votes,0)::int AS aligned,
            COALESCE(cd.defections,0)::int    AS defections,
            COALESCE(cd.member_count,0)::int  AS "memberCount"
       FROM committee_discipline cd WHERE cd.committee_id = $1`,
    [match.id],
  );
  const h = headerRes.rows[0] ?? { counted: 0, aligned: 0, defections: 0, memberCount: 0 };

  const rosterRes = await pool.query(
    `SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
            mcp.party_short_name AS "partyShortName", mcp.party_name AS "partyName",
            m.photo_thumb_path AS "photoThumbPath",
            COALESCE(mcp.in_faction, false) AS "inFaction", m.active,
            md.counted_votes::int AS "countedVotes", md.defections::int AS "defections",
            CASE WHEN md.counted_votes > 0
                 THEN md.aligned_votes::float / md.counted_votes ELSE NULL END AS "disciplineScore"
       FROM member_committee_terms mct
       JOIN members m ON m.id = mct.member_id AND m.active
       JOIN member_discipline md ON md.member_id = m.id
       LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE mct.committee_id = $1 AND mct.ended_on IS NULL
      ORDER BY "disciplineScore" DESC NULLS LAST, m.full_name ASC`,
    [match.id],
  );

  return {
    committeeId: match.id,
    name: match.name,
    slug,
    counted: Number(h.counted),
    aligned: Number(h.aligned),
    defections: Number(h.defections),
    memberCount: Number(h.memberCount),
    members: rosterRes.rows as RosterMember[],
  };
}

export type MemberCommittee = {
  committeeId: number;
  name: string;
  slug: string;
  cohesion: number | null;
  memberScore: number | null;
  memberRank: number;
  totalMembers: number;
};

/** The member's current committees with each committee's cohesion + the member's rank in it.
 *  Powers the member-page committee-loyalty panel (D). */
export async function getMemberCommittees(memberId: number): Promise<MemberCommittee[]> {
  const { rows } = await pool.query(
    `WITH committee_members AS (
       SELECT mct.committee_id, mct.member_id,
              CASE WHEN md.counted_votes > 0
                   THEN md.aligned_votes::float / md.counted_votes END AS score
       FROM member_committee_terms mct
       JOIN members m ON m.id = mct.member_id AND m.active
       JOIN member_discipline md ON md.member_id = mct.member_id
       WHERE mct.ended_on IS NULL
         AND mct.committee_id IN (
           SELECT committee_id FROM member_committee_terms
           WHERE member_id = $1 AND ended_on IS NULL)
     ),
     ranked AS (
       SELECT committee_id, member_id, score,
              RANK() OVER (PARTITION BY committee_id ORDER BY score DESC NULLS LAST) AS rank,
              COUNT(*) OVER (PARTITION BY committee_id) AS total
       FROM committee_members
     )
     SELECT c.id AS "committeeId", c.name,
            CASE WHEN cd.counted_votes > 0
                 THEN cd.aligned_votes::float / cd.counted_votes END AS cohesion,
            r.score AS "memberScore", r.rank::int AS "memberRank", r.total::int AS "totalMembers"
     FROM ranked r
     JOIN committees c ON c.id = r.committee_id
     JOIN committee_discipline cd ON cd.committee_id = r.committee_id
     WHERE r.member_id = $1
     ORDER BY c.name`,
    [memberId],
  );
  return rows.map((r) => ({ ...r, slug: committeeSlug(r.name) })) as MemberCommittee[];
}
