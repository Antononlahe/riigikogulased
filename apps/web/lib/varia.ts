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

export type ChildRow = { fullName: string; slug: string; partyShortName: string | null; photoThumbPath: string | null; children: number };

/** Flat (category, member) row for the expandable people sections (hobbies / professions /
 *  universities). `detail` carries an optional per-member note (the profession, for the
 *  professions section; null elsewhere). Grouped client-side by `groupPeople`. */
export type PeopleRow = {
  category: string;
  fullName: string;
  slug: string;
  party: string | null;
  detail: string | null;
};
export type PeopleMember = { fullName: string; slug: string; party: string | null; detail: string | null };
export type PeopleGroup = { category: string; members: PeopleMember[] };

/** Group flat rows by category, dedup members by slug within a group, biggest group first
 *  (ties Estonian-collated by category). */
export function groupPeople(rows: PeopleRow[]): PeopleGroup[] {
  const map = new Map<string, PeopleGroup>();
  for (const r of rows) {
    let g = map.get(r.category);
    if (!g) {
      g = { category: r.category, members: [] };
      map.set(r.category, g);
    }
    if (!g.members.some((m) => m.slug === r.slug)) {
      g.members.push({ fullName: r.fullName, slug: r.slug, party: r.party, detail: r.detail });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.members.length - a.members.length || a.category.localeCompare(b.category, "et"),
  );
}
export type BirthPin = {
  town: string;
  lat: number;
  lon: number;
  members: { fullName: string; slug: string; party: string | null }[];
};
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
/** One member's top-3 most distinctive words (rank 1..3, rank-1 first), members ordered by
 *  their rank-1 score site-wide. */
export type MemberWord = {
  memberId: number;
  fullName: string;
  slug: string;
  party: string | null;
  words: { lemma: string; rank: number }[];
};

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

export type AbsenceSortKey = "total" | "absent" | "absentPct";

/** Sort an absence leaderboard by the given numeric column, name-ascending within a tie. */
export function sortAbsence(rows: AbsenceRow[], dir: "asc" | "desc", key: AbsenceSortKey = "absentPct"): AbsenceRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) =>
    a[key] === b[key] ? a.fullName.localeCompare(b.fullName, "et") : sign * (a[key] - b[key]),
  );
}
