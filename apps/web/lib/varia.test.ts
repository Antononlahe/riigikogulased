import { describe, it, expect } from "vitest";
import { sortAbsence, generationOf, friendshipCountry, groupPeople, type AbsenceRow, type PeopleRow } from "./varia";

const row = (o: Partial<AbsenceRow>): AbsenceRow => ({
  memberId: 1,
  fullName: "A",
  slug: "a",
  partyShortName: "RE",
  photoThumbPath: null,
  active: true,
  total: 100,
  absent: 10,
  absentPct: 10,
  ...o,
});

describe("sortAbsence", () => {
  it("orders by absentPct desc then name asc", () => {
    const rows = [
      row({ memberId: 1, fullName: "Bee", absentPct: 5 }),
      row({ memberId: 2, fullName: "Ann", absentPct: 20 }),
      row({ memberId: 3, fullName: "Cat", absentPct: 20 }),
    ];
    expect(sortAbsence(rows, "desc").map((r) => r.memberId)).toEqual([2, 3, 1]);
  });

  it("orders ascending when asked", () => {
    const rows = [
      row({ memberId: 1, absentPct: 5 }),
      row({ memberId: 2, absentPct: 20 }),
    ];
    expect(sortAbsence(rows, "asc").map((r) => r.memberId)).toEqual([1, 2]);
  });
});

describe("generationOf", () => {
  it("buckets by birth year using the official arvud-räägivad cohorts", () => {
    expect(generationOf(1996)).toBe("95+");
    expect(generationOf(1990)).toBe("85-94");
    expect(generationOf(1979)).toBe("75-84");
    expect(generationOf(1970)).toBe("65-74");
    expect(generationOf(1960)).toBe("55-64");
    expect(generationOf(1950)).toBe("-54");
  });

  it("puts boundary years in the higher (newer) cohort", () => {
    expect(generationOf(1995)).toBe("95+");
    expect(generationOf(1985)).toBe("85-94");
    expect(generationOf(1975)).toBe("75-84");
    expect(generationOf(1965)).toBe("65-74");
    expect(generationOf(1955)).toBe("55-64");
    expect(generationOf(1954)).toBe("-54");
  });
});

describe("groupPeople", () => {
  const p = (o: Partial<PeopleRow>): PeopleRow => ({ category: "x", fullName: "A", slug: "a", party: "RE", detail: null, ...o });

  it("groups by category, biggest first, and dedups members by slug", () => {
    const groups = groupPeople([
      p({ category: "sport", slug: "a" }),
      p({ category: "sport", slug: "a" }), // same member, second hobby phrase -> deduped
      p({ category: "sport", slug: "b" }),
      p({ category: "muusika", slug: "c" }),
    ]);
    expect(groups.map((g) => [g.category, g.members.length])).toEqual([
      ["sport", 2],
      ["muusika", 1],
    ]);
  });
});

describe("friendshipCountry", () => {
  it("extracts the country from a friendship-group name", () => {
    expect(friendshipCountry("Eesti-Soome parlamendirühm")).toBe("Soome");
    expect(friendshipCountry("Eesti-Kasahstani parlamendirühm")).toBe("Kasahstani");
  });
  it("handles an en-dash and falls back gracefully", () => {
    expect(friendshipCountry("Eesti–Ukraina parlamendirühm")).toBe("Ukraina");
    expect(friendshipCountry("Miski muu rühm")).toBe("Miski muu rühm");
  });
});
