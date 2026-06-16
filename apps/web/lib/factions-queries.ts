import { pool } from "./db";
import type { PartyShort } from "./party";
import type { FactionComparisonRow, RosterMember } from "./factions";

/** One row per parliamentary faction: cohesion counts, attendance, defections, member count. */
export async function getFactionComparison(): Promise<FactionComparisonRow[]> {
  const { rows } = await pool.query(`
    SELECT
      p.id            AS "partyId",
      p.short_name    AS "partyShortName",
      p.name          AS "partyName",
      COALESCE(fd.counted_votes, 0)::int AS "countedVotes",
      COALESCE(fd.aligned_votes, 0)::int AS "alignedVotes",
      COALESCE(fd.defections, 0)::int    AS defections,
      COALESCE(fa.present_ballots, 0)::int AS "presentBallots",
      COALESCE(fa.total_ballots, 0)::int   AS "totalBallots",
      COALESCE(mc.member_count, 0)::int    AS "memberCount"
    FROM parties p
    LEFT JOIN faction_discipline fd ON fd.party_id = p.id
    LEFT JOIN faction_attendance fa ON fa.party_id = p.id
    LEFT JOIN (
      SELECT mcp.party_id, COUNT(*) AS member_count
      FROM member_current_party mcp
      JOIN members m ON m.id = mcp.member_id
      WHERE mcp.party_id IS NOT NULL AND m.active
      GROUP BY mcp.party_id
    ) mc ON mc.party_id = p.id
    WHERE fd.counted_votes IS NOT NULL OR fa.total_ballots IS NOT NULL
    ORDER BY p.id
  `);
  return rows as FactionComparisonRow[];
}

export type FactionDetail = {
  partyShortName: PartyShort;
  partyName: string;
  countedVotes: number;
  alignedVotes: number;
  defections: number;
  presentBallots: number;
  totalBallots: number;
  memberCount: number;
  members: RosterMember[];
};

/** Header metrics + ranked member roster for one faction, or null for an unknown short name. */
export async function getFactionDetail(short: PartyShort): Promise<FactionDetail | null> {
  const headerRes = await pool.query(
    `SELECT
       p.short_name AS "partyShortName",
       p.name       AS "partyName",
       COALESCE(fd.counted_votes, 0)::int AS "countedVotes",
       COALESCE(fd.aligned_votes, 0)::int AS "alignedVotes",
       COALESCE(fd.defections, 0)::int    AS defections,
       COALESCE(fa.present_ballots, 0)::int AS "presentBallots",
       COALESCE(fa.total_ballots, 0)::int   AS "totalBallots"
     FROM parties p
     LEFT JOIN faction_discipline fd ON fd.party_id = p.id
     LEFT JOIN faction_attendance fa ON fa.party_id = p.id
     WHERE p.short_name = $1`,
    [short],
  );
  if (headerRes.rows.length === 0) return null;
  const h = headerRes.rows[0];

  const rosterRes = await pool.query(
    `SELECT
       m.id AS "memberId", m.full_name AS "fullName", m.slug,
       mcp.party_short_name AS "partyShortName", mcp.party_name AS "partyName",
       m.photo_thumb_path AS "photoThumbPath",
       COALESCE(mcp.in_faction, false) AS "inFaction",
       m.active AS "active",
       md.counted_votes AS "countedVotes",
       md.defections,
       CASE WHEN md.counted_votes > 0
            THEN md.aligned_votes::float / md.counted_votes
            ELSE NULL END AS "disciplineScore"
     FROM member_current_party mcp
     JOIN members m ON m.id = mcp.member_id
     JOIN member_discipline md ON md.member_id = m.id
     JOIN parties p ON p.id = mcp.party_id
     WHERE p.short_name = $1
     ORDER BY "disciplineScore" ASC NULLS LAST, m.full_name ASC`,
    [short],
  );

  const members = rosterRes.rows.map((r) => ({
    ...r,
    countedVotes: Number(r.countedVotes),
    defections: Number(r.defections),
  })) as RosterMember[];

  return {
    partyShortName: h.partyShortName,
    partyName: h.partyName,
    countedVotes: Number(h.countedVotes),
    alignedVotes: Number(h.alignedVotes),
    defections: Number(h.defections),
    presentBallots: Number(h.presentBallots),
    totalBallots: Number(h.totalBallots),
    memberCount: members.filter((m) => m.active).length,
    members,
  };
}
