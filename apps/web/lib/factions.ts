import { type PartyShort, isKnownParty } from "./party";

export type FactionComparisonRow = {
  partyId: number;
  partyShortName: PartyShort;
  partyName: string;
  countedVotes: number;
  alignedVotes: number;
  defections: number;
  presentBallots: number;
  totalBallots: number;
  memberCount: number;
};

/** A roster row reuses the members-table shape so DisciplineBar/PartyBadge drop in. */
export type RosterMember = {
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

export type FactionSortKey = "cohesion" | "attendance" | "members";
export type SortDir = "asc" | "desc";

/** Slug for a faction route segment: the short name, lowercased ("ekre", "e200", "i"). */
export function factionSlug(short: PartyShort): string {
  return short.toLowerCase();
}

/** Resolve a route slug back to a known party short name, or null. */
export function partyFromSlug(slug: string): PartyShort | null {
  const up = slug.toUpperCase();
  return isKnownParty(up) ? up : null;
}

export function cohesion(aligned: number, counted: number): number | null {
  return counted > 0 ? aligned / counted : null;
}

export function attendanceRate(present: number, total: number): number | null {
  return total > 0 ? present / total : null;
}

function sortValue(r: FactionComparisonRow, key: FactionSortKey): number | null {
  switch (key) {
    case "cohesion":
      return cohesion(r.alignedVotes, r.countedVotes);
    case "attendance":
      return attendanceRate(r.presentBallots, r.totalBallots);
    case "members":
      return r.memberCount;
  }
}

/**
 * Sort a copy of `rows`. Numeric nulls always sort last regardless of direction;
 * ties break by Estonian-collated short name ascending.
 */
export function sortFactions(
  rows: FactionComparisonRow[],
  key: FactionSortKey,
  dir: SortDir,
): FactionComparisonRow[] {
  const asc = dir === "asc";
  const byName = (a: FactionComparisonRow, b: FactionComparisonRow) =>
    a.partyShortName.localeCompare(b.partyShortName, "et");
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av === null && bv === null) return byName(a, b);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return asc ? av - bv : bv - av;
    return byName(a, b);
  });
}

/**
 * Identify the most- and least-loyal members for highlighting. Considers only members
 * with a non-null discipline score; returns null ids when fewer than two qualify.
 */
export function mostLeastLoyal(members: RosterMember[]): {
  mostId: number | null;
  leastId: number | null;
} {
  const scored = members.filter((m) => m.disciplineScore !== null);
  if (scored.length < 2) return { mostId: null, leastId: null };
  let most = scored[0];
  let least = scored[0];
  for (const m of scored) {
    if ((m.disciplineScore as number) > (most.disciplineScore as number)) most = m;
    if ((m.disciplineScore as number) < (least.disciplineScore as number)) least = m;
  }
  return { mostId: most.memberId, leastId: least.memberId };
}
