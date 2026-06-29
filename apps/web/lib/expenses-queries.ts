import { pool } from "./db";

// Per-MP expense compensations (kuluhüvitised), source: Riigikogu published summaries.
// member_expenses holds one row per (member, year): annual limit, total spent, and a JSONB
// category split. Discipline/alignment untouched -- this is a separate civic-transparency view.

export type ExpenseYear = {
  year: number;
  limit: number;
  spent: number;
  breakdown: Record<string, number>;
};

export type ExpenseLeaderRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  active: boolean;
  limit: number;
  spent: number;
  breakdown: Record<string, number>;
};

/** Years we have expense data for, newest first (drives the leaderboard year selector). */
export async function getExpenseYears(): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT year FROM member_expenses ORDER BY year DESC`,
  );
  return rows.map((r) => r.year as number);
}

/** All members with expense data for one year, for the leaderboard. NUMERIC comes back as a
 *  string from pg, so cast to number here. */
export async function getExpenseLeaderboard(year: number): Promise<ExpenseLeaderRow[]> {
  const { rows } = await pool.query(
    `SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
            mcp.party_short_name AS "partyShortName", m.photo_thumb_path AS "photoThumbPath",
            m.active, e.limit_eur AS "limit", e.spent_eur AS "spent", e.breakdown
       FROM member_expenses e
       JOIN members m ON m.id = e.member_id
       LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE e.year = $1
      ORDER BY e.spent_eur DESC`,
    [year],
  );
  return rows.map((r) => ({
    ...r,
    limit: Number(r.limit),
    spent: Number(r.spent),
    breakdown: r.breakdown ?? {},
  })) as ExpenseLeaderRow[];
}

/** One member's expense history, newest year first (member-page panel). */
export async function getMemberExpenses(memberId: number): Promise<ExpenseYear[]> {
  const { rows } = await pool.query(
    `SELECT year, limit_eur AS "limit", spent_eur AS "spent", breakdown
       FROM member_expenses WHERE member_id = $1 ORDER BY year DESC`,
    [memberId],
  );
  return rows.map((r) => ({
    year: r.year,
    limit: Number(r.limit),
    spent: Number(r.spent),
    breakdown: r.breakdown ?? {},
  }));
}
