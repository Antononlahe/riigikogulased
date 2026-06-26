import { describe, expect, it } from "vitest";
import {
  sortSpeakers,
  speakerMetric,
  speechBrowseOrderBy,
  compactNumber,
  type SpeakerRow,
} from "./speeches";

const row = (over: Partial<SpeakerRow>): SpeakerRow => ({
  memberId: 1, fullName: "X", slug: "x", partyShortName: "RE", photoThumbPath: null,
  active: true, boardRole: null, daysInTerm: 1170, speeches: 10, questions: 20, procedural: 5, total: 35,
  totalWords: 1000, avgWords: 100, ...over,
});

describe("sortSpeakers", () => {
  it("sorts by the chosen metric desc, name tiebreak", () => {
    const rows = [
      row({ memberId: 1, fullName: "B", total: 35 }),
      row({ memberId: 2, fullName: "A", total: 50 }),
      row({ memberId: 3, fullName: "A2", total: 50 }),
    ];
    expect(sortSpeakers(rows, "total", "desc").map((r) => r.memberId)).toEqual([2, 3, 1]);
  });
  it("can sort ascending and reads each metric", () => {
    const rows = [row({ memberId: 1, questions: 5 }), row({ memberId: 2, questions: 1 })];
    expect(sortSpeakers(rows, "questions", "asc").map((r) => r.memberId)).toEqual([2, 1]);
    expect(speakerMetric(row({ speeches: 7 }), "speeches")).toBe(7);
  });
});

describe("tenure normalization (rate mode)", () => {
  it("normalizes volume metrics per month but leaves avgWords + tenure raw", () => {
    const r = row({ daysInTerm: 30.44, total: 10, avgWords: 120 });
    expect(speakerMetric(r, "total", "rate")).toBeCloseTo(10, 5); // 10 over ~1 month
    expect(speakerMetric(r, "avgWords", "rate")).toBe(120); // per-speech ratio: not normalized
    expect(speakerMetric(r, "tenure", "rate")).toBeCloseTo(1, 5); // months served
  });
  it("parks sub-floor (low-tenure) members at the bottom in rate mode, regardless of dir", () => {
    const veteran = row({ memberId: 1, daysInTerm: 1170, total: 100 }); // ~3.4k/mo? no: 100/38.4
    const rookie = row({ memberId: 2, daysInTerm: 20, total: 11 }); // 11/0.66 = huge rate, but flagged
    const ranked = sortSpeakers([rookie, veteran], "total", "desc", "rate");
    expect(ranked.map((r) => r.memberId)).toEqual([1, 2]); // rookie parked despite higher raw rate
  });
  it("does not park anyone in absolute mode", () => {
    const veteran = row({ memberId: 1, daysInTerm: 1170, total: 100 });
    const rookie = row({ memberId: 2, daysInTerm: 20, total: 11 });
    expect(sortSpeakers([rookie, veteran], "total", "desc", "abs").map((r) => r.memberId)).toEqual([
      1, 2,
    ]);
  });
});

describe("compactNumber", () => {
  it("abbreviates thousands and millions, leaves small numbers", () => {
    expect(compactNumber(139)).toBe("139");
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(12_345)).toBe("12k");
    expect(compactNumber(100_000)).toBe("100k");
    expect(compactNumber(1_234_567)).toBe("1.2M");
    expect(compactNumber(2_000_000)).toBe("2M");
  });
});

describe("speechBrowseOrderBy", () => {
  it("maps known sorts to fixed SQL", () => {
    expect(speechBrowseOrderBy("recent")).toBe("spoken_at DESC NULLS LAST");
    expect(speechBrowseOrderBy("oldest")).toBe("spoken_at ASC NULLS LAST");
    expect(speechBrowseOrderBy("longest")).toBe("length(text) DESC");
  });
  it("falls back to recent for unknown / injection input (never echoes input)", () => {
    const evil = "spoken_at; DROP TABLE member_speeches; --";
    expect(speechBrowseOrderBy(evil)).toBe("spoken_at DESC NULLS LAST");
    expect(speechBrowseOrderBy("")).toBe("spoken_at DESC NULLS LAST");
  });
});
