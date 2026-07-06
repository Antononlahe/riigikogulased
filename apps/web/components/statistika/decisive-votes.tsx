"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import type { DecisiveVote } from "@/lib/decisive-queries";

// Closest-calls list, tightest first, then the punchline: did any defection actually flip a
// result? Cards, not a table -- each vote carries a variable-length defector list.

function VoteCard({ v }: { v: DecisiveVote }) {
  const t = useTranslations("decisive");
  const choice = useTranslations("decisive.choice");
  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs tabular-nums text-muted-foreground">{v.votedAt}</span>
        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {t(v.requiredMajority === "members" ? "ruleMembers" : "ruleSimple")}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {v.title}
        </span>
      </div>
      <p className="mt-1.5 font-semibold">{v.subject ?? v.title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {t("result", { yes: v.yesCount, no: v.noCount })}{" "}
        </span>
        <span className={`font-semibold ${v.passed ? "text-foreground" : ""}`}>
          {t(v.passed ? "passed" : "failed")}
        </span>
        {" · "}
        <span className="tabular-nums">
          {t("counterfactual", { yes: v.cfYesCount, no: v.cfNoCount })}{" "}
        </span>
        <span className="font-semibold">
          {v.passed === v.cfPassed
            ? t("sameOutcome")
            : t(v.cfPassed ? "wouldPass" : "wouldFail")}
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {v.defectors.map((d) => (
          <li key={d.slug} className="flex items-center gap-1.5">
            <Link href={`/saadik/${d.slug}`} className="font-medium text-foreground hover:underline">
              {d.fullName}
            </Link>
            <PartyBadge shortName={d.partyShortName} />
            <span>
              {t("defected", {
                choice: choice(d.choice as "yes"),
                line: choice(d.partyLine as "yes"),
              })}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function DecisiveVotes({
  decisive,
  close,
  defectionVoteCount,
}: {
  decisive: DecisiveVote[];
  close: DecisiveVote[];
  defectionVoteCount: number;
}) {
  const t = useTranslations("decisive");

  return (
    <div className="space-y-8">
      {/* Lead: the closest calls, tightest first. */}
      <div>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">{t("closeIntro")}</p>
        {close.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("closeEmpty")}</p>
        ) : (
          <ul className="space-y-3">
            {close.map((v) => (
              <VoteCard key={v.voteId} v={v} />
            ))}
          </ul>
        )}
      </div>

      {/* Punchline: did any defection actually change a result? Usually none. */}
      <div className="rounded-md border-2 border-foreground p-5">
        {decisive.length === 0 ? (
          <>
            <p className="font-serif text-xl font-bold">{t("emptyHeadline")}</p>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {t("emptyBody", { defectionVotes: defectionVoteCount })}
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-xl font-bold">{t("flippedHeadline", { n: decisive.length })}</p>
            <ul className="mt-3 space-y-3">
              {decisive.map((v) => (
                <VoteCard key={v.voteId} v={v} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
