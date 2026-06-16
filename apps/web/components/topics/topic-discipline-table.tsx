import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PartyBadge } from "@/components/party-badge";
import { DisciplineBar } from "@/components/discipline-bar";
import { MEMBER_MIN_VOTES, splitByThreshold, type TopicMemberRow } from "@/lib/topics";

export async function TopicDisciplineTable({ members }: { members: TopicMemberRow[] }) {
  const t = await getTranslations("topics");
  const { ranked, belowThresholdCount } = splitByThreshold(members);

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <section>
      <h2 className="font-serif text-lg font-bold">{t("ranking")}</h2>
      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">{t("memberCol")}</th>
              <th className="px-4 py-3 text-right">{t("votesOnTopic")}</th>
              <th className="px-4 py-3 text-right">{t("defectionsCol")}</th>
              <th className="px-4 py-3 text-right">{t("disciplineCol")}</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.memberId} className="border-b border-border last:border-0 hover:bg-secondary">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 font-semibold">
                    <Link href={`/members/${r.slug}`} className="hover:underline">
                      {r.fullName}
                    </Link>
                    <PartyBadge shortName={r.partyShortName} />
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.counted}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.defections}</td>
                <td className="px-4 py-2.5">
                  <DisciplineBar score={r.disciplineScore} shortName={r.partyShortName} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {belowThresholdCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("belowThreshold", { n: belowThresholdCount, min: MEMBER_MIN_VOTES })}
        </p>
      )}
    </section>
  );
}
