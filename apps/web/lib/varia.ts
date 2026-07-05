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

export type TagCount = { tag: string; count: number };
export type PartyProfession = { partyShortName: string; members: number; distinct: number; top: TagCount[] };
export type UniRow = { university: string; count: number };
export type ChildRow = { fullName: string; slug: string; partyShortName: string | null; children: number };
export type BirthPin = { town: string; lat: number; lon: number; members: { fullName: string; slug: string }[] };
export type CaucusRow = { name: string; count: number; parties: string[] };
export type Globetrotter = { fullName: string; slug: string; partyShortName: string | null; groups: number };
export type CaucusMember = { name: string; fullName: string; slug: string; party: string | null };

/** "Eesti-Soome parlamendirühm" -> "Soome". Falls back to the raw name if the shape differs. */
export function friendshipCountry(name: string): string {
  const m = name.match(/^Eesti[-–]\s*(.+?)\s+parlamendirühm/i);
  return m ? m[1] : name.replace(/\s*parlamendirühm$/i, "");
}

export type SignatureWord = { lemma: string; score: number; rank: number };
export type PartyWords = { partyShortName: string; words: SignatureWord[] };

export type GenRow = {
  memberId: number;
  fullName: string;
  slug: string;
  partyShortName: string | null;
  photoThumbPath: string | null;
  birthYear: number;
  age: number;
};

/** Official arvud-räägivad birth cohorts, newest first. Boundary years fall in the newer bucket. */
export const GENERATIONS = ["95+", "85-94", "75-84", "65-74", "55-64", "-54"] as const;
export type Generation = (typeof GENERATIONS)[number];

export function generationOf(year: number): Generation {
  if (year >= 1995) return "95+";
  if (year >= 1985) return "85-94";
  if (year >= 1975) return "75-84";
  if (year >= 1965) return "65-74";
  if (year >= 1955) return "55-64";
  return "-54";
}

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
