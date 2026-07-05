import { describe, it, expect } from "vitest";
import { sortAbsence, type AbsenceRow } from "./varia";

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
