import { pool } from "./db";
import type { VotePoint } from "./member-detail";

export type MemberDisciplineRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  partyName: string | null;
  photoThumbPath: string | null;
  inFaction: boolean;
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
  committees: Affiliation[];
  districts: Affiliation[];
};

export async function getMemberDetail(slug: string): Promise<MemberDetail | null> {
  const memberRes = await pool.query(
    `SELECT m.id AS "memberId", m.full_name AS "fullName", m.slug,
            mcp.party_short_name AS "partyShortName", mcp.party_name AS "partyName",
            COALESCE(mcp.in_faction, false) AS "inFaction",
            m.photo_thumb_path AS "photoThumbPath", m.photo_url AS "photoUrl",
            m.date_of_birth AS "dateOfBirth", m.gender, m.email, m.phone,
            m.parliament_seniority_days AS "senorityDays",
            m.mandate_started_on AS "mandateStartedOn"
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
            MIN(v.voted_at) AS "firstDate", MAX(v.voted_at) AS "lastDate"
       FROM member_vote_alignment mva
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
    `SELECT v.voted_at AS "votedAt", v.title, v.draft_title AS "draftTitle",
            mva.member_choice AS "memberChoice", mva.party_majority_choice AS "partyMajorityChoice",
            mva.is_procedural AS "isProcedural", p.short_name AS "partyShortName"
       FROM member_vote_alignment mva
       JOIN votes v ON v.id = mva.vote_id
       LEFT JOIN parties p ON p.id = mva.party_id
      WHERE mva.member_id = $1
      ORDER BY v.voted_at`,
    [id],
  );

  const committeesRes = await pool.query(
    `SELECT c.name, ct.started_on AS "startedOn", ct.ended_on AS "endedOn"
       FROM member_committee_terms ct JOIN committees c ON c.id = ct.committee_id
      WHERE ct.member_id = $1 ORDER BY ct.started_on DESC NULLS LAST`,
    [id],
  );
  const districtsRes = await pool.query(
    `SELECT d.name, NULL::date AS "startedOn", NULL::date AS "endedOn"
       FROM member_district_terms dt JOIN electoral_districts d ON d.id = dt.district_id
      WHERE dt.member_id = $1`,
    [id],
  );

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
    committees: committeesRes.rows as Affiliation[],
    districts: districtsRes.rows as Affiliation[],
  };
}
