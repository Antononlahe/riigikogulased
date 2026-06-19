import { describe, expect, it } from "vitest";
import {
  committeeSlug,
  cohesion,
  committeeMetric,
  sortCommittees,
  type CommitteeRow,
} from "./committees";

const row = (over: Partial<CommitteeRow>): CommitteeRow => ({
  committeeId: 1, name: "X", slug: "x", counted: 100, aligned: 99, defections: 1,
  memberCount: 10, ...over,
});

describe("committeeSlug", () => {
  it("transliterates Estonian letters and lowercases", () => {
    expect(committeeSlug("Õiguskomisjon")).toBe("oiguskomisjon");
    expect(committeeSlug("Väliskomisjon")).toBe("valiskomisjon");
  });
  it("collapses non-alnum runs to single dashes and trims", () => {
    expect(committeeSlug("Euroopa Liidu asjade komisjon")).toBe("euroopa-liidu-asjade-komisjon");
    expect(committeeSlug("  -- A/B -- ")).toBe("a-b");
  });
});

describe("cohesion", () => {
  it("is null with no counted votes", () => {
    expect(cohesion(0, 0)).toBeNull();
    expect(cohesion(9, 10)).toBeCloseTo(0.9);
  });
});

describe("committeeMetric + sortCommittees", () => {
  it("sorts by cohesion desc with name tiebreak", () => {
    const rows = [
      row({ committeeId: 1, name: "B", aligned: 90, counted: 100 }), // 0.90
      row({ committeeId: 2, name: "A", aligned: 95, counted: 100 }), // 0.95
      row({ committeeId: 3, name: "C", aligned: 95, counted: 100 }), // 0.95 -> tie, A before C
    ];
    const out = sortCommittees(rows, "cohesion", "desc").map((r) => r.committeeId);
    expect(out).toEqual([2, 3, 1]);
  });
  it("nulls (no counted votes) always sort last", () => {
    const rows = [row({ committeeId: 1, counted: 0, aligned: 0 }), row({ committeeId: 2 })];
    expect(sortCommittees(rows, "cohesion", "asc")[1].committeeId).toBe(1);
    expect(committeeMetric(row({ counted: 0 }), "cohesion")).toBeNull();
  });
});
