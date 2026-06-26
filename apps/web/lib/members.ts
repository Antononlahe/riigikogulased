import type { MemberDisciplineRow } from "./queries";

export type SortKey = "discipline" | "name" | "counted" | "defections" | "votes";
export type SortDir = "asc" | "desc";

function numericValue(r: MemberDisciplineRow, key: Exclude<SortKey, "name">): number | null {
  switch (key) {
    case "discipline":
      return r.disciplineScore;
    case "counted":
      return r.countedVotes;
    case "defections":
      return r.defections;
    case "votes":
      return r.electionVotes;
  }
}

export type MandateKey =
  | "personal"
  | "district"
  | "compensation"
  | "substitute"
  | "notElected"
  | null;

/** The election-mandate label key for a member, mirroring the member-page election panel:
 *  elected -> mandate type; non-elected but still sitting -> substitute (asendusliige);
 *  non-elected and gone -> notElected; no recorded result -> null (renders as "—"). */
export function mandateKey(
  r: Pick<MemberDisciplineRow, "elected" | "mandateType" | "active">,
): MandateKey {
  if (r.elected === null) return null;
  if (r.elected) return (r.mandateType ?? "PERSONAL").toLowerCase() as MandateKey;
  return r.active ? "substitute" : "notElected";
}

/**
 * Sort a copy of `rows`. Numeric nulls always sort last regardless of direction
 * (mirrors the SQL `ORDER BY disciplineScore ASC NULLS LAST`); ties break by
 * Estonian-collated name ascending.
 */
export function sortRows(rows: MemberDisciplineRow[], key: SortKey, dir: SortDir): MemberDisciplineRow[] {
  const asc = dir === "asc";
  const byName = (a: MemberDisciplineRow, b: MemberDisciplineRow) =>
    a.fullName.localeCompare(b.fullName, "et");

  return [...rows].sort((a, b) => {
    if (key === "name") {
      const c = byName(a, b);
      return asc ? c : -c;
    }
    const av = numericValue(a, key);
    const bv = numericValue(b, key);
    if (av === null && bv === null) return byName(a, b);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return asc ? av - bv : bv - av;
    return byName(a, b);
  });
}

export function filterByParty(
  rows: MemberDisciplineRow[],
  party: string | null,
): MemberDisciplineRow[] {
  if (!party) return rows;
  return rows.filter((r) => r.partyShortName === party);
}
