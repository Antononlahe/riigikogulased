import { getTranslations } from "next-intl/server";
import { againstVotes, eelnouUrl, type VotePoint } from "@/lib/member-detail";

/**
 * List of the member's "against the faction line" votes, newest first. Each row links to the
 * bill (eelnõu) on the Riigikogu site, where the documents and full text live. This is the
 * accessible, keyboard-navigable counterpart to clicking marks on the timeline.
 */
export async function VotesAgainst({ votes }: { votes: VotePoint[] }) {
  const t = await getTranslations("memberDetail");
  const rows = againstVotes(votes);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-bold">{t("againstTitle")}</h2>
        {rows.length > 0 && (
          <span className="text-xs text-muted-foreground">{t("againstCount", { n: rows.length })}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("againstEmpty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {rows.map((v, i) => {
            const url = eelnouUrl(v.draftUuid);
            const title = v.draftTitle ?? v.title;
            const choiceLine = t("voteVsLine", {
              choice: t(`choiceShort.${v.memberChoice}` as "choiceShort.yes"),
              line: t(`choiceShort.${v.partyMajorityChoice}` as "choiceShort.yes"),
            });
            const body = (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {v.votedAt.slice(0, 10)}
                  </span>
                  <span className="font-medium">
                    {title}
                    {v.draftMark ? <span className="text-muted-foreground"> ({v.draftMark})</span> : null}
                  </span>
                </div>
                <div className="mt-0.5 pl-[5.5rem] text-xs text-muted-foreground">
                  {v.title !== title ? `${v.title} · ` : ""}
                  {choiceLine}
                </div>
              </>
            );
            return (
              <li key={i} className="px-3 py-2.5 text-sm hover:bg-secondary">
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t("openInRiigikogu")}
                    className="block hover:underline"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="block">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
