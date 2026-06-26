import { pool } from "./db";

// Per-MP election result (member_election_results). Source: RIA open data. Null if the member
// has no recorded result (e.g. former MPs predating the ingested election, or a substitute).
export type MemberElection = {
  electionCode: string;
  partyCode: string | null;
  districtNumber: number | null;
  personalVotes: number;
  elected: boolean;
  mandateType: "PERSONAL" | "DISTRICT" | "COMPENSATION" | null;
};

// RIA party codes -> the site's short names (RE/EKRE/KE/E200/SDE/I).
const RIA_TO_SHORT: Record<string, string> = {
  REF: "RE", EKRE: "EKRE", KESK: "KE", EE200: "E200", SDE: "SDE", IE: "I",
};

export type NonSittingCandidate = {
  fullName: string;
  partyShortName: string | null;
  districtNumber: number | null;
  personalVotes: number;
  mandateType: "PERSONAL" | "DISTRICT" | "COMPENSATION" | null;
};

/** Candidates who WON a mandate but never took a seat (declined: minister/MEP/mayor, e.g.
 *  Kõlvart). Ranked by personal votes. From election_candidates (see migration 0017). */
export async function getElectedNonSitting(
  electionCode = "RK_2023",
): Promise<NonSittingCandidate[]> {
  const { rows } = await pool.query(
    `SELECT forename, surname, party_code AS "partyCode", district_number AS "districtNumber",
            personal_votes AS "personalVotes", mandate_type AS "mandateType"
       FROM election_candidates
      WHERE election_code = $1
      ORDER BY personal_votes DESC`,
    [electionCode],
  );
  return rows.map((r) => ({
    fullName: `${r.forename} ${r.surname}`
      .toLocaleLowerCase("et")
      .replace(/(^|[\s-])([\p{L}])/gu, (_m, sep, ch) => sep + ch.toLocaleUpperCase("et")),
    partyShortName: r.partyCode ? (RIA_TO_SHORT[r.partyCode] ?? null) : null,
    districtNumber: r.districtNumber,
    personalVotes: r.personalVotes,
    mandateType: r.mandateType,
  }));
}

export async function getMemberElection(memberId: number): Promise<MemberElection | null> {
  const { rows } = await pool.query(
    `SELECT election_code AS "electionCode", party_code AS "partyCode",
            district_number AS "districtNumber", personal_votes AS "personalVotes",
            elected, mandate_type AS "mandateType"
       FROM member_election_results
      WHERE member_id = $1
      ORDER BY election_code DESC
      LIMIT 1`,
    [memberId],
  );
  return (rows[0] as MemberElection | undefined) ?? null;
}
