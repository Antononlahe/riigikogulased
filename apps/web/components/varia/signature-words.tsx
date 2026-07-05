"use client";

import { PartyBadge } from "@/components/party-badge";
import { partyToken, PARTY_ORDER, isKnownParty } from "@/lib/party";
import type { PartyWords } from "@/lib/varia";

// Map a rank (1 = most distinctive) to a font size. Rank-based, not score-based, so one party's
// huge score spread doesn't make its chips dwarf another's -- every card reads on the same scale.
function sizeForRank(rank: number): string {
  const px = Math.max(12, 30 - (rank - 1) * 1.4);
  return `${px}px`;
}

export function SignatureWords({ parties }: { parties: PartyWords[] }) {
  const order = (p: PartyWords) => {
    const i = PARTY_ORDER.indexOf(p.partyShortName as never);
    return i === -1 ? 99 : i;
  };
  const sorted = [...parties].sort((a, b) => order(a) - order(b));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sorted.map((p) => {
        const token = partyToken(p.partyShortName);
        return (
          <div key={p.partyShortName} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <PartyBadge shortName={p.partyShortName} />
              {isKnownParty(p.partyShortName) && (
                <span className="text-sm font-semibold text-muted-foreground">{token.label}</span>
              )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {p.words.map((w) => (
                <span
                  key={w.lemma}
                  title={`#${w.rank}`}
                  className="font-semibold leading-tight"
                  style={{ fontSize: sizeForRank(w.rank), color: token.ink }}
                >
                  {w.lemma}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
