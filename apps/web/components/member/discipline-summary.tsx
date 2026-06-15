import { useTranslations } from "next-intl";
import { DisciplineBar } from "@/components/discipline-bar";

export function DisciplineSummary({
  counted,
  aligned,
  defections,
  partyShortName,
}: {
  counted: number;
  aligned: number;
  defections: number;
  partyShortName: string | null;
}) {
  const t = useTranslations("memberDetail");
  const score = counted > 0 ? aligned / counted : null;
  return (
    <section className="flex flex-wrap items-center gap-6">
      <div className="min-w-40">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("discipline")}</div>
        <DisciplineBar score={score} shortName={partyShortName} />
      </div>
      <Stat label={t("counted")} value={counted} />
      <Stat label={t("against")} value={defections} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl tabular-nums">{value}</div>
    </div>
  );
}
