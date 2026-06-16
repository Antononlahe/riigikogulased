import { describe, it, expect } from "vitest";
import {
  factionSlug,
  partyFromSlug,
  cohesion,
  attendanceRate,
  sortFactions,
  mostLeastLoyal,
  type FactionComparisonRow,
  type RosterMember,
} from "./factions";

function row(partial: Partial<FactionComparisonRow>): FactionComparisonRow {
  return {
    partyId: 1,
    partyShortName: "RE",
    partyName: "Reformierakond",
    countedVotes: 100,
    alignedVotes: 90,
    defections: 10,
    presentBallots: 80,
    totalBallots: 100,
    memberCount: 30,
    ...partial,
  };
}

describe("slug mapping", () => {
  it("lowercases the short name", () => {
    expect(factionSlug("EKRE")).toBe("ekre");
    expect(factionSlug("E200")).toBe("e200");
    expect(factionSlug("I")).toBe("i");
  });
  it("round-trips known slugs and rejects unknown", () => {
    expect(partyFromSlug("ekre")).toBe("EKRE");
    expect(partyFromSlug("E200")).toBe("E200");
    expect(partyFromSlug("xyz")).toBeNull();
  });
});

describe("ratios", () => {
  it("computes cohesion, null when no counted votes", () => {
    expect(cohesion(90, 100)).toBeCloseTo(0.9);
    expect(cohesion(0, 0)).toBeNull();
  });
  it("computes attendance, null when no ballots", () => {
    expect(attendanceRate(80, 100)).toBeCloseTo(0.8);
    expect(attendanceRate(0, 0)).toBeNull();
  });
});

describe("sortFactions", () => {
  const rows = [
    row({ partyShortName: "RE", alignedVotes: 90, countedVotes: 100, memberCount: 30 }),
    row({ partyShortName: "EKRE", alignedVotes: 98, countedVotes: 100, memberCount: 17 }),
    row({ partyShortName: "KE", alignedVotes: 94, countedVotes: 100, memberCount: 16 }),
  ];
  it("defaults to cohesion descending", () => {
    expect(sortFactions(rows, "cohesion", "desc").map((r) => r.partyShortName)).toEqual([
      "EKRE",
      "KE",
      "RE",
    ]);
  });
  it("sorts by members ascending", () => {
    expect(sortFactions(rows, "members", "asc").map((r) => r.partyShortName)).toEqual([
      "KE",
      "EKRE",
      "RE",
    ]);
  });
  it("does not mutate the input", () => {
    const before = rows.map((r) => r.partyShortName);
    sortFactions(rows, "cohesion", "asc");
    expect(rows.map((r) => r.partyShortName)).toEqual(before);
  });
});

describe("mostLeastLoyal", () => {
  const members: RosterMember[] = [
    { memberId: 1, fullName: "A", slug: "a", partyShortName: "RE", partyName: "RE", photoThumbPath: null, inFaction: true, active: true, countedVotes: 50, defections: 1, disciplineScore: 0.98 },
    { memberId: 2, fullName: "B", slug: "b", partyShortName: "RE", partyName: "RE", photoThumbPath: null, inFaction: true, active: true, countedVotes: 50, defections: 5, disciplineScore: 0.90 },
    { memberId: 3, fullName: "C", slug: "c", partyShortName: "RE", partyName: "RE", photoThumbPath: null, inFaction: true, active: true, countedVotes: 0, defections: 0, disciplineScore: null },
  ];
  it("picks highest and lowest scored members, ignoring null-score members", () => {
    const { mostId, leastId } = mostLeastLoyal(members);
    expect(mostId).toBe(1);
    expect(leastId).toBe(2);
  });
  it("returns nulls when fewer than two scored members", () => {
    const { mostId, leastId } = mostLeastLoyal([members[0], members[2]]);
    expect(mostId).toBeNull();
    expect(leastId).toBeNull();
  });
});
