import { useTranslations } from "next-intl";
import type { MemberElection } from "@/lib/election-queries";

// Compact sidebar card: how the MP won their 2023 seat. Personal votes + mandate type
// (PERSONAL = won a full quota alone, DISTRICT = district mandate, COMPENSATION = off the
// national list). Source: RIA election open data.
export function ElectionPanel({ election }: { election: MemberElection }) {
  const t = useTranslations("memberDetail.election");
  const m = election.mandateType.toLowerCase() as "personal" | "district" | "compensation";
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
      <div className="mt-2 font-serif text-2xl font-bold tabular-nums">
        {election.personalVotes.toLocaleString("et")}
      </div>
      <div className="text-xs text-muted-foreground">{t("personalVotes")}</div>
      <div className="mt-3">
        <span className="inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
          {t(`mandate.${m}`)}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">{t(`mandateNote.${m}`)}</p>
      </div>
      {election.districtNumber != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("district", { n: election.districtNumber })}
        </p>
      )}
    </div>
  );
}
