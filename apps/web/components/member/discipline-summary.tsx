import { useTranslations } from "next-intl";
import { DisciplineBar } from "@/components/discipline-bar";
import { ComparePopover } from "@/components/member/compare-popover";

export function DisciplineSummary({
  counted,
  aligned,
  defections,
  attendance,
  partyShortName,
  avgDiscipline,
}: {
  counted: number;
  aligned: number;
  defections: number;
  attendance?: number | null; // 0..1 share of non-procedural votes present
  partyShortName: string | null;
  avgDiscipline?: number | null;
}) {
  const t = useTranslations("memberDetail");
  const score = counted > 0 ? aligned / counted : null;
  return (
    <section className="flex flex-wrap items-center gap-6">
      <div className="min-w-40">
        <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          {t("discipline")}
          {score != null && avgDiscipline != null && (
            <ComparePopover
              ariaLabel={t("compare.aria")}
              memberLabel={t("compare.member")}
              memberValue={`${Math.round(score * 100)}%`}
              othersLabel={t("compare.others")}
              othersValue={`${Math.round(avgDiscipline * 100)}%`}
            />
          )}
        </div>
        <DisciplineBar score={score} shortName={partyShortName} />
      </div>
      <Stat label={t("counted")} value={counted} />
      <Stat label={t("against")} value={defections} />
      {attendance != null && <Stat label={t("attendance")} value={`${(attendance * 100).toFixed(1)}%`} />}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl tabular-nums">{value}</div>
    </div>
  );
}
