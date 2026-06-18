export type VoteClass = "aligned" | "against" | "excluded";

export type VotePoint = {
  voteId: number;
  votedAt: string; // ISO timestamp
  title: string;
  draftTitle: string | null;
  draftMark: string | null;
  draftUuid: string | null;
  riigikoguUuid: string | null;
  memberChoice: string;
  partyMajorityChoice: string | null;
  isProcedural: boolean;
  partyShortName: string | null;
};

const REGISTERED = new Set(["yes", "no", "abstain"]);

export function classifyVote(v: VotePoint): VoteClass {
  if (v.isProcedural || !REGISTERED.has(v.memberChoice) || v.partyMajorityChoice === null) {
    return "excluded";
  }
  return v.memberChoice === v.partyMajorityChoice ? "aligned" : "against";
}

/**
 * Public Riigikogu page for the bill (eelnõu) a vote belongs to — where the documents and
 * full text live. Null when the vote has no linked draft.
 */
export function eelnouUrl(draftUuid: string | null): string | null {
  return draftUuid ? `https://www.riigikogu.ee/tegevus/eelnoud/eelnou/${draftUuid}` : null;
}

/** The member's "against the faction line" votes, most recent first. */
export function againstVotes(votes: VotePoint[]): VotePoint[] {
  return votes
    .filter((v) => classifyVote(v) === "against")
    .sort((a, b) => b.votedAt.localeCompare(a.votedAt));
}

/**
 * How a defection departed from the line: "abstain" = the member abstained (erapooletu)
 * where the faction had a yes/no line; "differ" = the member cast the opposite ballot.
 */
export type AgainstKind = "abstain" | "differ";
export function againstKind(v: VotePoint): AgainstKind {
  return v.memberChoice === "abstain" ? "abstain" : "differ";
}

/**
 * Coarse vote type for filtering, derived from the voting title. Numbered amendments
 * ("10. muudatusettepanek") collapse to a single "Muudatusettepanek"; other titles
 * (Lõpphääletus, Tagasi lükkamine, …) are already type names and pass through.
 */
export function voteType(v: VotePoint): string {
  return /muudatusettepanek/i.test(v.title) ? "Muudatusettepanek" : v.title.trim();
}

/** Distinct vote types present in `votes`, Estonian-collated. */
export function voteTypeOptions(votes: VotePoint[]): string[] {
  return [...new Set(votes.map(voteType))].sort((a, b) => a.localeCompare(b, "et"));
}

/** Ballot tally for a voting (counts of each choice). */
export type Tally = { yes: number; no: number; abstain: number; absent: number };
export type FactionTally = Tally & { party: string };
/** Full result for one voting: overall counts + per-faction breakdown (faction-at-time). */
export type VoteResult = { overall: Tally; factions: FactionTally[] };

export type MonthPoint = {
  month: string; // "YYYY-MM"
  aligned: number;
  against: number;
  score: number | null;
};

export function monthlyDiscipline(votes: VotePoint[]): MonthPoint[] {
  const byMonth = new Map<string, { aligned: number; against: number }>();
  for (const v of [...votes].sort((a, b) => a.votedAt.localeCompare(b.votedAt))) {
    const month = v.votedAt.slice(0, 7);
    const acc = byMonth.get(month) ?? { aligned: 0, against: 0 };
    const c = classifyVote(v);
    if (c === "aligned") acc.aligned += 1;
    else if (c === "against") acc.against += 1;
    byMonth.set(month, acc);
  }
  return [...byMonth.entries()].map(([month, { aligned, against }]) => {
    const scored = aligned + against;
    return { month, aligned, against, score: scored > 0 ? aligned / scored : null };
  });
}

export type SwitchPoint = {
  date: string;
  fromParty: string | null;
  toParty: string | null;
};

export function partySwitchPoints(votes: VotePoint[]): SwitchPoint[] {
  const sorted = [...votes].sort((a, b) => a.votedAt.localeCompare(b.votedAt));
  const out: SwitchPoint[] = [];
  let prev: string | null | undefined;
  for (const v of sorted) {
    if (prev !== undefined && v.partyShortName !== prev) {
      out.push({ date: v.votedAt, fromParty: prev, toParty: v.partyShortName });
    }
    prev = v.partyShortName;
  }
  return out;
}
