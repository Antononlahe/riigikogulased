import { useTranslations } from "next-intl";
import type { PartyBreakdownRow } from "@/lib/queries";
import { PartyBadge } from "@/components/party-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export function PartyBreakdown({ rows }: { rows: PartyBreakdownRow[] }) {
  const t = useTranslations("memberDetail");
  if (rows.length <= 1) return null;
  const fmt = (iso: string) => iso.slice(0, 10);
  return (
    <section>
      <h2 className="font-serif text-lg font-bold">{t("byParty")}</h2>
      <ScrollableTable className="mt-3" minWidthClass="min-w-[30rem]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase text-muted-foreground">
            <th className="py-2">{t("party")}</th>
            <th className="py-2">{t("period")}</th>
            <th className="py-2 text-right">{t("discipline")}</th>
            <th className="py-2 text-right">{t("against")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="py-2">
                <PartyBadge shortName={r.partyShortName} name={r.partyName} />
              </td>
              <td className="py-2 tabular-nums text-muted-foreground">
                {fmt(r.firstDate)} – {fmt(r.lastDate)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {r.counted > 0 ? `${Math.round((r.aligned / r.counted) * 100)}%` : "—"}
              </td>
              <td className="py-2 text-right tabular-nums">{r.defections}</td>
            </tr>
          ))}
        </tbody>
      </ScrollableTable>
    </section>
  );
}
