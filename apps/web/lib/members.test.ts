import { describe, it, expect } from "vitest";
import { sortRows, filterByParty } from "./members";
import type { MemberDisciplineRow } from "./queries";

function row(p: Partial<MemberDisciplineRow>): MemberDisciplineRow {
  return {
    memberId: 0,
    fullName: "X",
    slug: "x",
    partyShortName: "RE",
    partyName: "Reform",
    photoThumbPath: null,
    countedVotes: 0,
    defections: 0,
    disciplineScore: 0,
    ...p,
  };
}

const rows: MemberDisciplineRow[] = [
  row({ fullName: "Bobi", disciplineScore: 0.95, countedVotes: 100, defections: 5, partyShortName: "RE" }),
  row({ fullName: "Anna", disciplineScore: 1.0, countedVotes: 80, defections: 0, partyShortName: "SDE" }),
  row({ fullName: "Cara", disciplineScore: 0.95, countedVotes: 120, defections: 6, partyShortName: "RE" }),
  row({ fullName: "Dirk", disciplineScore: null, countedVotes: 0, defections: 0, partyShortName: null }),
];

describe("sortRows", () => {
  it("discipline ascending puts nulls last and breaks ties by name (matches SQL default)", () => {
    const out = sortRows(rows, "discipline", "asc").map((r) => r.fullName);
    expect(out).toEqual(["Bobi", "Cara", "Anna", "Dirk"]);
  });

  it("discipline descending keeps nulls last", () => {
    const out = sortRows(rows, "discipline", "desc").map((r) => r.fullName);
    expect(out).toEqual(["Anna", "Bobi", "Cara", "Dirk"]);
  });

  it("name sorts with Estonian collation and respects direction", () => {
    expect(sortRows(rows, "name", "asc").map((r) => r.fullName)).toEqual(["Anna", "Bobi", "Cara", "Dirk"]);
    expect(sortRows(rows, "name", "desc").map((r) => r.fullName)).toEqual(["Dirk", "Cara", "Bobi", "Anna"]);
  });

  it("does not mutate the input array", () => {
    const before = rows.map((r) => r.fullName);
    sortRows(rows, "defections", "desc");
    expect(rows.map((r) => r.fullName)).toEqual(before);
  });
});

describe("filterByParty", () => {
  it("returns all rows when party is null", () => {
    expect(filterByParty(rows, null)).toHaveLength(4);
  });
  it("filters to the matching party", () => {
    expect(filterByParty(rows, "RE").map((r) => r.fullName)).toEqual(["Bobi", "Cara"]);
  });
});
