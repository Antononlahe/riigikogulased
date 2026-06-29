import { useTranslations } from "next-intl";
import type { ExpenseYear } from "@/lib/expenses-queries";

// CSV category key -> ascii message key (keeps next-intl keys ascii; labels live in messages).
const CAT_KEY: Record<string, string> = {
  "sõidukulud": "travel",
  "side_ja_postikulud": "comms",
  "lähetuskulud": "trips",
  "majutuskulud": "lodging",
  "bürookulud": "office",
  "koolituskulud": "training",
  "tõlketeenuse_kulud": "translation",
  "uuringud_ja_ekspertiisid": "research",
  "esindus_ja_vastuvõtukulud": "representation",
  "tervishoiuteenused": "healthcare",
};

const eur = (n: number) =>
  n.toLocaleString("et", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// Member-page panel: annual expense compensation (kuluhüvitised). A spent/limit bar per year,
// plus the category split for the most recent year. Source: Riigikogu published summaries.
export function ExpensePanel({ years }: { years: ExpenseYear[] }) {
  const t = useTranslations("memberDetail.expenses");
  if (years.length === 0) return null;
  const latest = years[0];
  const cats = Object.entries(latest.breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-serif text-lg font-bold">{t("title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("intro")}</p>

      <div className="mt-4 space-y-3">
        {years.map((y) => {
          const pct = y.limit > 0 ? Math.min(100, (y.spent / y.limit) * 100) : 0;
          return (
            <div key={y.year}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold tabular-nums">{y.year}</span>
                <span className="tabular-nums text-muted-foreground">
                  {eur(y.spent)} / {eur(y.limit)}{" "}
                  <span className="text-foreground">({Math.round(pct)}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-sm bg-secondary">
                <div className="h-full rounded-sm bg-foreground/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {cats.length > 0 && (
        <div className="mt-5">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("breakdownHeading", { year: latest.year })}
          </h4>
          <ul className="mt-2 space-y-1 text-sm">
            {cats.map(([key, amount]) => (
              <li key={key} className="flex justify-between">
                <span className="text-muted-foreground">
                  {t(`categories.${CAT_KEY[key] ?? "other"}` as "categories.travel")}
                </span>
                <span className="tabular-nums">{eur(amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
