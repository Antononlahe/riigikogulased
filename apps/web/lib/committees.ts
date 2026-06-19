// v0.4 committee cohesion (REMOVABLE FEATURE). Pure helpers + types; queries live in
// committees-queries.ts. "Committee cohesion" = aggregate plenary discipline of a
// committee's current members (see 0010_committee_rollup.sql) -- the API has no per-member
// committee ballots, so this is a membership rollup, not a committee-internal vote tally.

export type CommitteeRow = {
  committeeId: number;
  name: string;
  slug: string;
  counted: number;
  aligned: number;
  defections: number;
  memberCount: number;
};

/** One (committee, party) cohesion cell for the matrix; null cohesion = party not on it. */
export type CommitteeMatrixCell = { cohesion: number | null; memberCount: number };

export type CommitteeSortKey = "cohesion" | "members" | "defections";
export type SortDir = "asc" | "desc";

/** Slugify a committee name to a route segment. Mirrors the scraper's db._slugify so the
 *  same name maps to the same slug on both sides. */
export function committeeSlug(name: string): string {
  const repl: Record<string, string> = {
    õ: "o", ä: "a", ö: "o", ü: "u", š: "s", ž: "z",
  };
  const s = name
    .toLowerCase()
    .replace(/[õäöüšž]/g, (c) => repl[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "komisjon";
}

export function cohesion(aligned: number, counted: number): number | null {
  return counted > 0 ? aligned / counted : null;
}

export function committeeMetric(r: CommitteeRow, key: CommitteeSortKey): number | null {
  switch (key) {
    case "cohesion":
      return cohesion(r.aligned, r.counted);
    case "members":
      return r.memberCount;
    case "defections":
      return r.defections;
  }
}

/** Sort a copy of rows; numeric nulls always last; ties break by Estonian-collated name. */
export function sortCommittees(
  rows: CommitteeRow[],
  key: CommitteeSortKey,
  dir: SortDir,
): CommitteeRow[] {
  const asc = dir === "asc";
  const byName = (a: CommitteeRow, b: CommitteeRow) => a.name.localeCompare(b.name, "et");
  return [...rows].sort((a, b) => {
    const av = committeeMetric(a, key);
    const bv = committeeMetric(b, key);
    if (av === null && bv === null) return byName(a, b);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return asc ? av - bv : bv - av;
    return byName(a, b);
  });
}
