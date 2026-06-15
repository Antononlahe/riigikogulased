import { pool } from "./db";

export type MemberDisciplineRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  partyName: string | null;
  photoThumbPath: string | null;
  countedVotes: number;
  defections: number;
  disciplineScore: number | null;
};

export async function getMemberDiscipline(): Promise<MemberDisciplineRow[]> {
  const { rows } = await pool.query(`
    SELECT
      md.member_id      AS "memberId",
      md.full_name      AS "fullName",
      md.slug,
      mcp.party_short_name AS "partyShortName",
      mcp.party_name       AS "partyName",
      m.photo_thumb_path   AS "photoThumbPath",
      md.counted_votes  AS "countedVotes",
      md.defections,
      CASE WHEN md.counted_votes > 0
           THEN md.aligned_votes::float / md.counted_votes
           ELSE NULL END AS "disciplineScore"
    FROM member_discipline md
    JOIN members m ON m.id = md.member_id
    LEFT JOIN member_current_party mcp ON mcp.member_id = md.member_id
    ORDER BY "disciplineScore" ASC NULLS LAST, md.full_name ASC
  `);
  return rows;
}
