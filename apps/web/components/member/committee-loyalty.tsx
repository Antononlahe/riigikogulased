// v0.4-D member-page committee loyalty (REMOVABLE FEATURE). Per the member's current
// committees: each committee's cohesion + this member's discipline and rank within it.
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { MemberCommittee } from "@/lib/committees-queries";

function pct(v: number | null): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toFixed(1)}%`;
}

export async function CommitteeLoyalty({ committees }: { committees: MemberCommittee[] }) {
  const t = await getTranslations("memberDetail");
  if (committees.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 font-serif text-lg font-bold">{t("committeeLoyalty")}</h2>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 text-left font-bold">{t("committee")}</th>
              <th className="px-3 py-2 text-right font-bold">{t("committeeCohesion")}</th>
              <th className="px-3 py-2 text-right font-bold">{t("yourDiscipline")}</th>
              <th className="px-3 py-2 text-right font-bold">{t("rankInCommittee")}</th>
            </tr>
          </thead>
          <tbody>
            {committees.map((c) => (
              <tr key={c.committeeId} className="border-b border-border last:border-0 hover:bg-secondary">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/statistika/komisjonid/${c.slug}`} className="hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {pct(c.cohesion)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {pct(c.memberScore)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {c.memberRank}/{c.totalMembers}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
