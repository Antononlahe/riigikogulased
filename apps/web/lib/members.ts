import type { MemberDisciplineRow } from "./queries";

export type SortKey = "discipline" | "name" | "counted" | "defections";
export type SortDir = "asc" | "desc";

function numericValue(r: MemberDisciplineRow, key: Exclude<SortKey, "name">): number | null {
  switch (key) {
    case "discipline":
      return r.disciplineScore;
    case "counted":
      return r.countedVotes;
    case "defections":
      return r.defections;
  }
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
