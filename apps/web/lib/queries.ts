import { pool } from "./db";
import type { VotePoint, VoteResult, Tally } from "./member-detail";

export type MemberDisciplineRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  partyName: string | null;
  photoThumbPath: string | null;
  inFaction: boolean;
  active: boolean;
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
      COALESCE(mcp.in_faction, false) AS "inFaction",
      m.active             AS "active",
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

export type MemberRecord = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  partyName: string | null;
  inFaction: boolean;
  active: boolean;
  photoThumbPath: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  senorityDays: number | null;
  mandateStartedOn: string | null;
};

export type PartyBreakdownRow = {
  partyShortName: string | null;
  partyName: string | null;
  counted: number;
  aligned: number;
  defections: number;
  firstDate: string;
  lastDate: string;
};

export type Affiliation = { name: string; startedOn: string | null; endedOn: string | null };

export type MemberDetail = {
  member: MemberRecord;
  counted: number;
  aligned: number;
  defections: number;
  breakdown: PartyBreakdownRow[];
  votes: VotePoint[];
  voteResults: Record<number, VoteResult>;
  committees: Affiliation[];
  districts: Affiliation[];
};

export async function getMemberDetail(slug: string): Promise<MemberDetail | null> {
  const memberRes = await pool.query(
    `SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
            mcp.party_short_name AS "partyShortName", mcp.party_name AS "partyName",
            COALESCE(mcp.in_faction, false) AS "inFaction",
            m.active AS "active",
            m.photo_thumb_path AS "photoThumbPath", m.photo_url AS "photoUrl",
            m.date_of_birth::text AS "dateOfBirth", m.gender, m.email, m.phone,
            m.parliament_seniority_days AS "senorityDays",
            m.mandate_started_on::text AS "mandateStartedOn"
       FROM members m
       LEFT JOIN member_current_party mcp ON mcp.member_id = m.id
      WHERE m.slug = $1`,
    [slug],
  );
  if (memberRes.rows.length === 0) return null;
  const member = memberRes.rows[0] as MemberRecord;
  const id = member.memberId;

  const summaryRes = await pool.query(
    `SELECT counted_votes AS counted, aligned_votes AS aligned, defections
       FROM member_discipline WHERE member_id = $1`,
    [id],
  );
  const summary = summaryRes.rows[0] ?? { counted: 0, aligned: 0, defections: 0 };

  const breakdownRes = await pool.query(
    `SELECT p.short_name AS "partyShortName", p.name AS "partyName",
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural) AS counted,
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
              AND mva.member_choice = mva.party_majority_choice) AS aligned,
            COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
              AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural
              AND mva.member_choice <> mva.party_majority_choice) AS defections,
            MIN(v.voted_at)::text AS "firstDate", MAX(v.voted_at)::text AS "lastDate"
       FROM ballot_alignment mva
       JOIN votes v ON v.id = mva.vote_id
       LEFT JOIN parties p ON p.id = mva.party_id
      WHERE mva.member_id = $1
      GROUP BY p.short_name, p.name
      HAVING COUNT(*) FILTER (WHERE mva.party_majority_choice IS NOT NULL
        AND mva.member_choice IN ('yes','no','abstain') AND NOT mva.is_procedural) > 0
      ORDER BY MIN(v.voted_at)`,
    [id],
  );

  const votesRes = await pool.query(
    `SELECT v.id AS "voteId", v.voted_at AS "votedAt", v.title, v.draft_title AS "draftTitle",
            v.draft_mark AS "draftMark", v.draft_uuid AS "draftUuid",
            v.riigikogu_uuid AS "riigikoguUuid",
            mva.member_choice AS "memberChoice", mva.party_majority_choice AS "partyMajorityChoice",
            mva.is_procedural AS "isProcedural", p.short_name AS "partyShortName"
       FROM ballot_alignment mva
       JOIN votes v ON v.id = mva.vote_id
       LEFT JOIN parties p ON p.id = mva.party_id
      WHERE mva.member_id = $1
      ORDER BY v.voted_at`,
    [id],
  );

  const committeesRes = await pool.query(
    `SELECT c.name,
            MAX(ct.started_on)::text AS "startedOn",
            MAX(ct.ended_on)::text   AS "endedOn"
       FROM member_committee_terms ct JOIN committees c ON c.id = ct.committee_id
      WHERE ct.member_id = $1
      GROUP BY c.name
      ORDER BY MAX(ct.started_on) DESC NULLS LAST`,
    [id],
  );
  // Districts can span multiple Riigikogu terms (a returning MP represented a different
  // valimisringkond in an earlier koosseis); the app is scoped to the XV Riigikogu, so show
  // only this term's district(s). term number 15 = the current koosseis.
  const districtsRes = await pool.query(
    `SELECT DISTINCT d.name, NULL::text AS "startedOn", NULL::text AS "endedOn"
       FROM member_district_terms dt
       JOIN electoral_districts d ON d.id = dt.district_id
       JOIN riigikogu_terms rt ON rt.id = dt.term_id
      WHERE dt.member_id = $1 AND rt.number = 15`,
    [id],
  );

  // Per-faction ballot tallies for the member's defection votings (the "how they voted" panel).
  // Defection vote ids are computed with the same predicate as lib/member-detail classifyVote.
  const REG = new Set(["yes", "no", "abstain"]);
  const defectionIds = (
    votesRes.rows as Array<{
      voteId: number;
      isProcedural: boolean;
      memberChoice: string;
      partyMajorityChoice: string | null;
    }>
  )
    .filter(
      (r) =>
        !r.isProcedural &&
        r.partyMajorityChoice !== null &&
        REG.has(r.memberChoice) &&
        r.memberChoice !== r.partyMajorityChoice,
    )
    .map((r) => r.voteId);

  const voteResults: Record<number, VoteResult> = {};
  if (defectionIds.length > 0) {
    const TALLY = `
      COUNT(*) FILTER (WHERE b.choice = 'yes')::int     AS yes,
      COUNT(*) FILTER (WHERE b.choice = 'no')::int      AS no,
      COUNT(*) FILTER (WHERE b.choice = 'abstain')::int AS abstain,
      COUNT(*) FILTER (WHERE b.choice IN ('absent','neutral'))::int AS absent`;
    const overallRes = await pool.query(
      `SELECT b.vote_id AS "voteId", ${TALLY}
         FROM ballots b WHERE b.vote_id = ANY($1::int[]) GROUP BY b.vote_id`,
      [defectionIds],
    );
    const factionRes = await pool.query(
      `SELECT b.vote_id AS "voteId", p.short_name AS party, ${TALLY}
         FROM ballots b
         JOIN votes v ON v.id = b.vote_id
         JOIN member_faction_terms mft ON mft.member_id = b.member_id
           AND mft.started_on <= v.voted_at::date
           AND (mft.ended_on IS NULL OR mft.ended_on > v.voted_at::date)
           AND mft.party_id IS NOT NULL
         JOIN parties p ON p.id = mft.party_id
        WHERE b.vote_id = ANY($1::int[])
        GROUP BY b.vote_id, p.short_name`,
      [defectionIds],
    );
    for (const r of overallRes.rows as Array<{ voteId: number } & Tally>) {
      voteResults[r.voteId] = {
        overall: { yes: r.yes, no: r.no, abstain: r.abstain, absent: r.absent },
        factions: [],
      };
    }
    for (const r of factionRes.rows as Array<{ voteId: number; party: string } & Tally>) {
      voteResults[r.voteId]?.factions.push({
        party: r.party,
        yes: r.yes,
        no: r.no,
        abstain: r.abstain,
        absent: r.absent,
      });
    }
  }

  return {
    member,
    counted: Number(summary.counted),
    aligned: Number(summary.aligned),
    defections: Number(summary.defections),
    breakdown: breakdownRes.rows.map((r) => ({
      ...r,
      counted: Number(r.counted),
      aligned: Number(r.aligned),
      defections: Number(r.defections),
    })) as PartyBreakdownRow[],
    votes: votesRes.rows.map((r) => ({
      ...r,
      votedAt: new Date(r.votedAt).toISOString(),
    })) as VotePoint[],
    voteResults,
    committees: committeesRes.rows as Affiliation[],
    districts: districtsRes.rows as Affiliation[],
  };
}
