// Pure helpers + shared row types for the /statistika/varia stats. No DB access here (that
// lives in varia-queries.ts) so this stays unit-testable without a database.

export type AbsenceRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  active: boolean;
  total: number; // non-procedural ballots cast (any choice)
  absent: number; // of those, choice = 'absent'
  absentPct: number; // 100 * absent / total, 1 decimal
};

/** Sort an absence leaderboard by absent %, name-ascending within a tie. */
export function sortAbsence(rows: AbsenceRow[], dir: "asc" | "desc"): AbsenceRow[] {
  const asc = [...rows].sort((a, b) =>
    a.absentPct === b.absentPct
      ? a.fullName.localeCompare(b.fullName, "et")
      : a.absentPct - b.absentPct,
  );
  // desc: reverse the pct order but keep the name tiebreak ascending within each pct group.
  if (dir === "asc") return asc;
  const desc = [...rows].sort((a, b) =>
    a.absentPct === b.absentPct
      ? a.fullName.localeCompare(b.fullName, "et")
      : b.absentPct - a.absentPct,
  );
  return desc;
}
