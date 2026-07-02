import { pool } from "./db";

// "Decisive votes" (v0.4 extra): non-procedural votes where voting against the
// fraktsioon line flipped the outcome (vote_decisiveness view, migration 0022), plus
// the near-miss list behind the "almost" toggle. Thresholds are respected: passed is
// yes > no OR yes >= 51 depending on votes.required_majority (see 0022 for the rules).

export type DecisiveVote = {
  voteId: number;
  votedAt: string; // ISO date
  title: string;
  subject: string | null; // draft or document title
  requiredMajority: "simple" | "members";
  yesCount: number;
  noCount: number;
  defections: number;
  cfYesCount: number;
  cfNoCount: number;
  passed: boolean;
  cfPassed: boolean;
  flipGap: number;
  defectors: Defector[];
};

export type Defector = {
  voteId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  choice: string;
  partyLine: string;
};

const SELECT = `
  SELECT vote_id  AS "voteId", to_char(voted_at, 'YYYY-MM-DD') AS "votedAt", title,
         COALESCE(draft_title, document_title) AS subject,
         required_majority AS "requiredMajority",
         yes_count AS "yesCount", no_count AS "noCount", defections,
         cf_yes_count AS "cfYesCount", cf_no_count AS "cfNoCount",
         passed, cf_passed AS "cfPassed", flip_gap AS "flipGap"
    FROM vote_decisiveness`;

async function withDefectors(rows: Omit<DecisiveVote, "defectors">[]): Promise<DecisiveVote[]> {
  if (rows.length === 0) return [];
  const { rows: defs } = await pool.query(
    `SELECT ba.vote_id AS "voteId", m.full_name AS "fullName", m.slug,
            p.short_name AS "partyShortName",
            ba.member_choice AS choice, ba.party_majority_choice AS "partyLine"
       FROM ballot_alignment ba
       JOIN members m ON m.id = ba.member_id
       LEFT JOIN parties p ON p.id = ba.party_id
      WHERE ba.vote_id = ANY($1)
        AND NOT ba.is_procedural
        AND ba.member_choice IN ('yes','no','abstain')
        AND ba.party_majority_choice IS NOT NULL
        AND ba.member_choice <> ba.party_majority_choice
      ORDER BY m.full_name`,
    [rows.map((r) => r.voteId)],
  );
  const byVote = new Map<number, Defector[]>();
  for (const d of defs as Defector[]) {
    const list = byVote.get(d.voteId) ?? [];
    list.push(d);
    byVote.set(d.voteId, list);
  }
  return rows.map((r) => ({ ...r, defectors: byVote.get(r.voteId) ?? [] }));
}

/** Votes whose outcome the defections actually flipped. Expected to be rare (or empty). */
export async function getDecisiveVotes(): Promise<DecisiveVote[]> {
  const { rows } = await pool.query(
    `${SELECT} WHERE passed <> cf_passed ORDER BY voted_at DESC`,
  );
  return withDefectors(rows);
}

/** Near misses: the defectors were numerically enough to flip the outcome
 *  (flip_gap <= defections) but it did not flip. */
export async function getCloseVotes(limit = 50): Promise<DecisiveVote[]> {
  const { rows } = await pool.query(
    `${SELECT}
      WHERE passed = cf_passed AND defections > 0 AND flip_gap <= defections
      ORDER BY voted_at DESC
      LIMIT $1`,
    [limit],
  );
  return withDefectors(rows);
}

/** Headline denominator: how many non-procedural votes had any defection at all. */
export async function getDefectionVoteCount(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM vote_decisiveness WHERE defections > 0`,
  );
  return rows[0]?.n ?? 0;
}
