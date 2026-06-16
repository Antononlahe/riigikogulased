import { describe, expect, it } from "vitest";
import {
  MEMBER_MIN_VOTES,
  INDEX_MIN_VOTES,
  topicLabel,
  disciplineScore,
  splitByThreshold,
  type TopicMemberRow,
} from "./topics";

function m(p: Partial<TopicMemberRow>): TopicMemberRow {
  return {
    memberId: 1,
    fullName: "Test Liige",
    slug: "test-liige",
    partyShortName: "RE",
    inFaction: true,
    counted: 5,
    aligned: 5,
    defections: 0,
    ...p,
  };
}

describe("topicLabel", () => {
  it("uses the Estonian label by default", () => {
    expect(topicLabel({ nameEt: "riigieelarve", nameEn: "state budget" }, "et")).toBe("riigieelarve");
  });
  it("uses the English label for the en locale", () => {
    expect(topicLabel({ nameEt: "riigieelarve", nameEn: "state budget" }, "en")).toBe("state budget");
  });
  it("falls back to Estonian when the English label is missing", () => {
    expect(topicLabel({ nameEt: "riigieelarve", nameEn: null }, "en")).toBe("riigieelarve");
  });
});

describe("disciplineScore", () => {
  it("returns aligned / counted", () => {
    expect(disciplineScore(4, 5)).toBe(0.8);
  });
  it("returns null when there are no counted votes", () => {
    expect(disciplineScore(0, 0)).toBeNull();
  });
});

describe("splitByThreshold", () => {
  it("ranks only members at or above the per-member minimum", () => {
    const rows = [
      m({ memberId: 1, counted: MEMBER_MIN_VOTES, aligned: MEMBER_MIN_VOTES }),
      m({ memberId: 2, counted: MEMBER_MIN_VOTES - 1, aligned: MEMBER_MIN_VOTES - 1 }),
      m({ memberId: 3, counted: 0, aligned: 0 }),
    ];
    const { ranked, belowThresholdCount } = splitByThreshold(rows);
    expect(ranked.map((r) => r.memberId)).toEqual([1]);
    expect(belowThresholdCount).toBe(1); // member 2 only; member 3 had no counted votes
  });
  it("sorts worst discipline first, then most defections", () => {
    const rows = [
      m({ memberId: 1, counted: 10, aligned: 10, defections: 0 }), // 100%
      m({ memberId: 2, counted: 10, aligned: 8, defections: 2 }), // 80%
      m({ memberId: 3, counted: 10, aligned: 8, defections: 2 }), // 80% tie
    ];
    const { ranked } = splitByThreshold(rows);
    expect(ranked[0].disciplineScore).toBeCloseTo(0.8);
    expect(ranked[ranked.length - 1].disciplineScore).toBe(1);
  });
  it("exposes INDEX_MIN_VOTES as 5", () => {
    expect(INDEX_MIN_VOTES).toBe(5);
  });
});
