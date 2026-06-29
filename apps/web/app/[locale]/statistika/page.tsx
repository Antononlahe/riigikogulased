// v0.5 statistics page (REMOVABLE FEATURE). Two leaderboards, switched by the ?vaade= search
// param (server-driven, shareable, only the selected dataset is fetched -- the tables are ~100
// rows each, too long to stack): speakers (v0.5-A) and kuluhüvitised / expense compensations.
// The committee cohesion sections were removed (2026-06-22): the metric proxied plenary
// discipline because the API exposes no per-committee roll-call votes, which read as misleading.
// Remove the page by deleting the app/[locale]/statistika tree, the statistika components,
// speeches*/expenses* lib modules, migrations 0011 + 0020, and the nav link in site-header.
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SpeakerLeaderboard } from "@/components/statistika/speaker-leaderboard";
import { ExpenseLeaderboard } from "@/components/statistika/expense-leaderboard";
import { getSpeechLeaderboard } from "@/lib/speeches-queries";
import { getExpenseLeaderboard, getExpenseYears } from "@/lib/expenses-queries";
import type { SpeakerRow } from "@/lib/speeches";
import type { ExpenseLeaderRow } from "@/lib/expenses-queries";

export const revalidate = 3600;

export default async function StatisticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vaade?: string; aasta?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("statistika");
  const footer = await getTranslations("footer");

  const view = sp.vaade === "kulud" ? "kulud" : "kone";

  // Only fetch the dataset being shown.
  let speakers: SpeakerRow[] = [];
  let expenses: ExpenseLeaderRow[] = [];
  let years: number[] = [];
  let year = 0;
  if (view === "kone") {
    try {
      speakers = await getSpeechLeaderboard();
    } catch {
      /* empty state */
    }
  } else {
    try {
      years = await getExpenseYears();
      year = years.includes(Number(sp.aasta)) ? Number(sp.aasta) : (years[0] ?? 0);
      if (year) expenses = await getExpenseLeaderboard(year);
    } catch {
      /* empty state */
    }
  }

  const tab = (key: "kone" | "kulud", label: string) => (
    <Link
      href={key === "kone" ? "/statistika" : "/statistika?vaade=kulud"}
      className={`px-3 py-1.5 text-[13px] font-semibold ${
        view === key
          ? "bg-foreground text-background"
          : "bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-serif text-2xl font-bold tracking-tight">{t("heading")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>

        <div className="mt-6 inline-flex overflow-hidden rounded-md border border-border">
          {tab("kone", t("tabSpeakers"))}
          {tab("kulud", t("tabExpenses"))}
        </div>

        {view === "kone" ? (
          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold">{t("speakersHeading")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("speakersIntro")}</p>
            <div className="mt-5">
              {speakers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <SpeakerLeaderboard rows={speakers} />
              )}
            </div>
          </section>
        ) : (
          <section className="mt-8">
            <h2 className="font-serif text-xl font-bold">{t("expensesHeading")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("expensesIntro")}</p>
            {years.length > 1 && (
              <div className="mt-4 inline-flex overflow-hidden rounded-md border border-border">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={`/statistika?vaade=kulud&aasta=${y}`}
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
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <ExpenseLeaderboard rows={expenses} />
              )}
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{footer("source")}</p>
        </footer>
      </main>
    </>
  );
}
