import { pool } from "./db";
import type { FactionComparisonRow } from "./factions";

/** One row per parliamentary faction: cohesion counts, attendance, defections, member count. */
export async function getFactionComparison(): Promise<FactionComparisonRow[]> {
  const { rows } = await pool.query(`
    SELECT
      p.id            AS "partyId",
      p.short_name    AS "partyShortName",
      p.name          AS "partyName",
      COALESCE(fd.counted_votes, 0)::int AS "countedVotes",
      COALESCE(fd.aligned_votes, 0)::int AS "alignedVotes",
      COALESCE(fd.defections, 0)::int    AS "defections",
      COALESCE(fa.present_ballots, 0)::int AS "presentBallots",
      COALESCE(fa.total_ballots, 0)::int   AS "totalBallots",
      COALESCE(mc.member_count, 0)::int    AS "memberCount",
      COALESCE(ex.spent, 0)::float AS "expenseSpent",
      COALESCE(ex.lim,   0)::float AS "expenseLimit"
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
    -- Pooled expense usage: total spent / total limit over the faction's current members,
    -- across all years (member_expenses, 2023-25). Attributed by current faction.
    LEFT JOIN (
      SELECT mcp.party_id, SUM(e.spent_eur) AS spent, SUM(e.limit_eur) AS lim
      FROM member_expenses e
      JOIN member_current_party mcp ON mcp.member_id = e.member_id
      WHERE mcp.party_id IS NOT NULL
      GROUP BY mcp.party_id
    ) ex ON ex.party_id = p.id
    -- parties also holds non-parliamentary erakonds (seeded by the äriregister
    -- reconciliation, 0003); restrict to actual fraktsioons -- parties that have/had a
    -- faction bench. COALESCE keeps a faction with no scored votes yet at 0 rather than dropped.
    WHERE EXISTS (SELECT 1 FROM member_faction_terms mft WHERE mft.party_id = p.id)
    ORDER BY p.id
  `);
  return rows as FactionComparisonRow[];
}
