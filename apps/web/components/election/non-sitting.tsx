import { getTranslations } from "next-intl/server";
import type { NonSittingCandidate } from "@/lib/election-queries";
import { PartyBadge } from "@/components/party-badge";

// People who won a mandate in 2023 but never took their Riigikogu seat (declined to stay a
// minister / MEP / mayor -- e.g. Mihhail Kõlvart). They have no member page, so names are plain
// text. Ranked by personal votes. Source: RIA election open data (election_candidates).
export async function NonSitting({ rows }: { rows: NonSittingCandidate[] }) {
  const t = await getTranslations("nonSitting");
  const te = await getTranslations("memberDetail.election");
  return (
    <section className="mt-12">
      <h2 className="font-serif text-xl font-bold">{t("heading")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
      <div className="mt-4 overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3 text-right">{t("votes")}</th>
              <th className="px-4 py-3">{t("mandate")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-3 font-semibold">
                    {r.fullName}
                    <PartyBadge shortName={r.partyShortName} />
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                  {r.personalVotes.toLocaleString("et")}
                </td>
                <td className="px-4 py-2.5">
                  {r.mandateType && (
                    <span className="inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
                      {te(`mandate.${r.mandateType.toLowerCase()}` as "mandate.personal")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
