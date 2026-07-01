import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ExpenseLeaderboard } from "./expense-leaderboard";
import { getExpenseLeaderboard, getExpenseYears } from "@/lib/expenses-queries";

// Expenses leaderboard for one year, shared by /statistika/kulud (latest year) and
// /statistika/kulud/[aasta]. Year selector links to those static paths (latest -> base,
// others -> /kulud/<year>), so switching years is a CDN hit, not a dynamic render.
export async function ExpensesSection({ year }: { year: number }) {
  const t = await getTranslations("statistika");
  const years = await getExpenseYears();
  const latest = years[0] ?? 0;
  const rows = year ? await getExpenseLeaderboard(year) : [];
  return (
    <section className="mt-8">
      <h2 className="font-serif text-xl font-bold">{t("expensesHeading")}</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("expensesIntro")}</p>
      {years.length > 1 && (
        <div className="mt-4 inline-flex overflow-hidden rounded-md border border-border">
          {years.map((y) => (
            <Link
              key={y}
              href={y === latest ? "/statistika/kulud" : `/statistika/kulud/${y}`}
              aria-current={y === year ? "page" : undefined}
              className={`px-3 py-1.5 text-[13px] font-semibold tabular-nums ${
                y === year
                  ? "bg-foreground text-background"
                  : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-5">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ExpenseLeaderboard rows={rows} />
        )}
      </div>
    </section>
  );
}
