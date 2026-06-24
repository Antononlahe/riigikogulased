import { useTranslations } from "next-intl";
import type { MemberElection } from "@/lib/election-queries";

// Compact sidebar card: how the MP got their 2023 seat. Personal votes + mandate type for
// those elected outright (PERSONAL = full quota alone, DISTRICT, COMPENSATION = off the
// national list); for the non-elected, whether they entered as a substitute (asendusliige,
// active MP) or simply did not win (former). Source: RIA election open data.
export function ElectionPanel({
  election,
  active,
}: {
  election: MemberElection;
  active: boolean;
}) {
  const t = useTranslations("memberDetail.election");
  // Key into the mandate/note message groups: the mandate type when elected, else substitute
  // (still sitting) or notElected (gone).
  const key = election.elected
    ? (election.mandateType ?? "PERSONAL").toLowerCase()
    : active
      ? "substitute"
      : "notElected";
  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
      <div className="mt-2 font-serif text-2xl font-bold tabular-nums">
        {election.personalVotes.toLocaleString("et")}
      </div>
      <div className="text-xs text-muted-foreground">{t("personalVotes")}</div>
      <div className="mt-3">
        <span className="inline-block rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium">
          {t(`mandate.${key}` as "mandate.personal")}
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(`mandateNote.${key}` as "mandateNote.personal")}
        </p>
      </div>
      {election.districtNumber != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("district", { n: election.districtNumber })}
        </p>
      )}
    </div>
  );
}
