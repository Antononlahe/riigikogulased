import { describe, expect, it } from "vitest";
import {
  classifyVote,
  monthlyDiscipline,
  partySwitchPoints,
  eelnouUrl,
  againstVotes,
  againstKind,
  voteType,
  voteTypeOptions,
  type VotePoint,
} from "./member-detail";

function v(p: Partial<VotePoint>): VotePoint {
  return {
    voteId: 1,
    votedAt: "2025-09-12T10:00:00.000Z",
    title: "Lõpphääletus",
    draftTitle: null,
    draftMark: null,
    draftUuid: null,
    riigikoguUuid: null,
    memberChoice: "yes",
    partyMajorityChoice: "yes",
    isProcedural: false,
    partyShortName: "RE",
    ...p,
  };
}

describe("classifyVote", () => {
  it("aligned when choice equals the party line", () => {
    expect(classifyVote(v({ memberChoice: "yes", partyMajorityChoice: "yes" }))).toBe("aligned");
  });
  it("against when choice differs from the line", () => {
    expect(classifyVote(v({ memberChoice: "no", partyMajorityChoice: "yes" }))).toBe("against");
  });
  it("excluded for procedural votes", () => {
    expect(classifyVote(v({ isProcedural: true }))).toBe("excluded");
  });
  it("excluded when absent / not a registered choice", () => {
    expect(classifyVote(v({ memberChoice: "absent" }))).toBe("excluded");
    expect(classifyVote(v({ memberChoice: "neutral" }))).toBe("excluded");
  });
  it("excluded when the party had no majority line", () => {
    expect(classifyVote(v({ partyMajorityChoice: null }))).toBe("excluded");
  });
});

describe("monthlyDiscipline", () => {
  it("buckets by month and ignores excluded votes", () => {
    const out = monthlyDiscipline([
      v({ votedAt: "2025-06-03T00:00:00Z", memberChoice: "yes", partyMajorityChoice: "yes" }),
      v({ votedAt: "2025-06-20T00:00:00Z", memberChoice: "no", partyMajorityChoice: "yes" }),
      v({ votedAt: "2025-06-25T00:00:00Z", isProcedural: true }),
      v({ votedAt: "2025-07-01T00:00:00Z", memberChoice: "yes", partyMajorityChoice: "yes" }),
    ]);
    expect(out).toEqual([
      { month: "2025-06", aligned: 1, against: 1, score: 0.5 },
      { month: "2025-07", aligned: 1, against: 0, score: 1 },
    ]);
  });
  it("score is null for a month with no scored votes", () => {
    const out = monthlyDiscipline([v({ votedAt: "2025-06-10T00:00:00Z", isProcedural: true })]);
    expect(out).toEqual([{ month: "2025-06", aligned: 0, against: 0, score: null }]);
  });
});

describe("eelnouUrl", () => {
  it("builds the Riigikogu eelnõu URL from a draft uuid", () => {
    expect(eelnouUrl("abc-123")).toBe(
      "https://www.riigikogu.ee/tegevus/eelnoud/eelnou/abc-123",
    );
  });
  it("is null without a draft", () => {
    expect(eelnouUrl(null)).toBeNull();
  });
});

describe("againstVotes", () => {
  it("keeps only against-line votes, most recent first", () => {
    const out = againstVotes([
      v({ votedAt: "2025-06-01T00:00:00Z", memberChoice: "yes", partyMajorityChoice: "yes" }), // aligned
      v({ votedAt: "2025-07-01T00:00:00Z", memberChoice: "no", partyMajorityChoice: "yes" }), // against
      v({ votedAt: "2025-08-01T00:00:00Z", isProcedural: true }), // excluded
      v({ votedAt: "2025-09-01T00:00:00Z", memberChoice: "abstain", partyMajorityChoice: "no" }), // against
    ]);
    expect(out.map((x) => x.votedAt)).toEqual([
      "2025-09-01T00:00:00Z",
      "2025-07-01T00:00:00Z",
    ]);
  });
});

describe("againstKind", () => {
  it("is 'abstain' when the member abstained", () => {
    expect(againstKind(v({ memberChoice: "abstain", partyMajorityChoice: "no" }))).toBe("abstain");
  });
  it("is 'differ' when the member cast the opposite ballot", () => {
    expect(againstKind(v({ memberChoice: "no", partyMajorityChoice: "yes" }))).toBe("differ");
    expect(againstKind(v({ memberChoice: "yes", partyMajorityChoice: "no" }))).toBe("differ");
  });
});

describe("voteType / voteTypeOptions", () => {
  it("collapses numbered amendments and passes other titles through", () => {
    expect(voteType(v({ title: "10. muudatusettepanek" }))).toBe("Muudatusettepanek");
    expect(voteType(v({ title: "Lõpphääletus" }))).toBe("Lõpphääletus");
  });
  it("lists distinct types sorted", () => {
    expect(
      voteTypeOptions([
        v({ title: "Lõpphääletus" }),
        v({ title: "3. muudatusettepanek" }),
        v({ title: "8. muudatusettepanek" }),
        v({ title: "Tagasi lükkamine" }),
      ]),
    ).toEqual(["Lõpphääletus", "Muudatusettepanek", "Tagasi lükkamine"]);
  });
});

describe("partySwitchPoints", () => {
  it("returns [] when the party never changes", () => {
    expect(
      partySwitchPoints([
        v({ votedAt: "2025-06-01T00:00:00Z", partyShortName: "EKRE" }),
        v({ votedAt: "2025-07-01T00:00:00Z", partyShortName: "EKRE" }),
      ]),
    ).toEqual([]);
  });
  it("marks the date where the scoring party changes", () => {
    expect(
      partySwitchPoints([
        v({ votedAt: "2025-06-01T00:00:00Z", partyShortName: "EKRE" }),
        v({ votedAt: "2025-08-15T00:00:00Z", partyShortName: "I" }),
        v({ votedAt: "2025-09-01T00:00:00Z", partyShortName: "I" }),
      ]),
    ).toEqual([{ date: "2025-08-15T00:00:00Z", fromParty: "EKRE", toParty: "I" }]);
  });
});
