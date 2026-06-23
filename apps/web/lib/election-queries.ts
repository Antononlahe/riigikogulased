import { pool } from "./db";

// Per-MP election result (member_election_results). Source: RIA open data. Null if the member
// has no recorded result (e.g. former MPs predating the ingested election, or a substitute).
export type MemberElection = {
  electionCode: string;
  partyCode: string | null;
  districtNumber: number | null;
  personalVotes: number;
  mandateType: "PERSONAL" | "DISTRICT" | "COMPENSATION";
};

export async function getMemberElection(memberId: number): Promise<MemberElection | null> {
  const { rows } = await pool.query(
    `SELECT election_code AS "electionCode", party_code AS "partyCode",
            district_number AS "districtNumber", personal_votes AS "personalVotes",
            mandate_type AS "mandateType"
       FROM member_election_results
      WHERE member_id = $1
      ORDER BY election_code DESC
      LIMIT 1`,
    [memberId],
  );
  return (rows[0] as MemberElection | undefined) ?? null;
}
